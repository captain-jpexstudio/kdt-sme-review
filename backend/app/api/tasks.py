"""Reviewer 검수 라우터 — spec §12. P2: list/get/autosave/submit."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import agreed_reviewer, ensure_not_locked, get_client_ip
from app.db.base import get_db
from app.db.models import AuditLog, BatchSubmission, Dataset, Task, User
from app.schemas.tasks import (
    AutosaveRequest,
    BatchEligibility,
    BatchSubmitRequest,
    BatchSubmitResponse,
    SubmitRequest,
    TaskDetail,
    TaskListItem,
    TaskMutationResponse,
    TaskSort,
    TaskStatus,
    TaskSummary,
)
from app.services.active_edit import ActiveEditError, diff_stats, verify_active_edit
from app.services.events import broadcaster
from app.services.pdf import render_and_store_pledge_pdf
from app.services.signature import SignatureError, store_signature
from app.services.storage import storage

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _validate_version(task: Task, version: int) -> None:
    if task.version != version:
        raise HTTPException(
            409,
            {
                "error_code": "VERSION_CONFLICT",
                "message": "다른 저장 내용이 있습니다. 새로고침 후 다시 시도하세요.",
                "current_version": task.version,
            },
        )


async def _owned_task_or_404(db: AsyncSession, user: User, task_id: uuid.UUID) -> tuple[Task, Dataset]:
    row = (
        await db.execute(
            select(Task, Dataset)
            .join(Dataset, Dataset.id == Task.dataset_id)
            .where(and_(Task.id == task_id, Task.user_id == user.id))
        )
    ).first()
    if row is None:
        raise HTTPException(404, {"error_code": "NOT_FOUND"})
    return row[0], row[1]


def _detail(task: Task, ds: Dataset) -> TaskDetail:
    return TaskDetail(
        task_id=task.id,
        dataset_id=ds.id,
        status=task.status,
        version=task.version,
        original_q=ds.original_q,
        original_a=ds.original_a,
        draft_q=task.draft_q,
        draft_a=task.draft_a,
        modified_q=task.modified_q,
        modified_a=task.modified_a,
        error_reasons=task.error_reasons or [],
        error_note=task.error_note,
        last_accessed_at=task.last_accessed_at,
        submitted_at=task.submitted_at,
    )


def _preview(text: str, limit: int = 80) -> str:
    s = " ".join((text or "").split())
    return s if len(s) <= limit else s[: limit - 1] + "…"


@router.get("/summary", response_model=TaskSummary)
async def summary(user: User = Depends(agreed_reviewer), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(Task.status, func.count())
            .where(Task.user_id == user.id)
            .group_by(Task.status)
        )
    ).all()
    counts = {"pending": 0, "in_progress": 0, "completed": 0}
    for status, count in rows:
        counts[status] = count
    return TaskSummary(total=sum(counts.values()), **counts)


@router.get("/list", response_model=list[TaskListItem])
async def list_tasks(
    status: TaskStatus | None = None,
    q: str | None = None,
    sort: TaskSort = "seq",
    user: User = Depends(agreed_reviewer),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Task, Dataset)
        .join(Dataset, Dataset.id == Task.dataset_id)
        .where(Task.user_id == user.id)
    )
    if status:
        stmt = stmt.where(Task.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Dataset.original_q.ilike(like), Dataset.original_a.ilike(like), Task.draft_a.ilike(like), Task.modified_a.ilike(like)))
    if sort == "status":
        stmt = stmt.order_by(
            case(
                (Task.status == "pending", 0),
                (Task.status == "in_progress", 1),
                else_=2,
            ),
            Task.dataset_id,
        )
    elif sort == "recent":
        stmt = stmt.order_by(Task.last_accessed_at.desc().nullslast(), Task.submitted_at.desc().nullslast(), Task.dataset_id)
    else:
        stmt = stmt.order_by(Task.dataset_id)

    rows = (await db.execute(stmt)).all()
    items: list[TaskListItem] = []
    for seq, (task, ds) in enumerate(rows, start=1):
        answer = task.modified_a or task.draft_a or ""
        stats = diff_stats(ds.original_a, answer) if answer else {"identical": True, "change_ratio": 0.0}
        items.append(
            TaskListItem(
                task_id=task.id,
                seq=seq,
                dataset_id=ds.id,
                status=task.status,
                q_preview=_preview(ds.original_q),
                edited=not stats["identical"],
                suspicious=bool(answer and stats["change_ratio"] < 0.05),
                last_accessed_at=task.last_accessed_at,
                submitted_at=task.submitted_at,
                version=task.version,
            )
        )
    return items


@router.get("/resume", response_model=TaskDetail | None)
async def resume(
    user: User = Depends(agreed_reviewer),
    db: AsyncSession = Depends(get_db),
):
    row = (
        await db.execute(
            select(Task, Dataset)
            .join(Dataset, Dataset.id == Task.dataset_id)
            .where(Task.user_id == user.id)
            .order_by(
                Task.last_accessed_at.desc().nullslast(),
                case((Task.status == "pending", 0), else_=1),
                Task.dataset_id,
            )
            .limit(1)
        )
    ).first()
    if row is None:
        return None
    task, ds = row[0], row[1]
    task.last_accessed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _detail(task, ds)


async def _completion_counts(db: AsyncSession, user: User) -> tuple[int, int]:
    rows = (
        await db.execute(
            select(Task.status, func.count())
            .where(Task.user_id == user.id)
            .group_by(Task.status)
        )
    ).all()
    counts = {status: count for status, count in rows}
    total = sum(counts.values())
    return counts.get("completed", 0), total


@router.get("/batch/eligibility", response_model=BatchEligibility)
async def batch_eligibility(
    user: User = Depends(agreed_reviewer),
    db: AsyncSession = Depends(get_db),
):
    completed, total = await _completion_counts(db, user)
    return BatchEligibility(
        completed=completed,
        total=total,
        eligible=total > 0 and completed == total and not user.is_batch_submitted,
        locked=user.is_batch_submitted,
    )


@router.post("/batch-submit", response_model=BatchSubmitResponse)
async def batch_submit(
    body: BatchSubmitRequest,
    request: Request,
    user: User = Depends(ensure_not_locked),
    db: AsyncSession = Depends(get_db),
):
    completed, total = await _completion_counts(db, user)
    if total == 0 or completed != total:
        raise HTTPException(
            400,
            {
                "error_code": "INCOMPLETE_TASKS",
                "message": "모든 배정 항목을 완료해야 최종 제출할 수 있습니다.",
                "detail": {"completed": completed, "total": total},
            },
        )

    ip = get_client_ip(request)
    signed_at = datetime.now(timezone.utc)
    try:
        asset = await store_signature(db, storage, user.id, "batch", body.typed_name, body.signature_png)
    except SignatureError as e:
        raise HTTPException(400, {"error_code": "SIGNATURE_REQUIRED", "message": str(e)})

    pdf_key = await render_and_store_pledge_pdf(
        storage,
        user,
        "batch",
        asset,
        ip,
        typed_name=body.typed_name,
        signed_at=signed_at,
        signature_png_url=body.signature_png,
    )
    db.add(
        BatchSubmission(
            user_id=user.id,
            typed_name=body.typed_name,
            signature_asset_id=asset.id,
            final_pdf_key=pdf_key,
            completed_count=completed,
            client_ip=ip,
            submitted_at=signed_at,
        )
    )
    user.is_batch_submitted = True
    user.batch_submitted_at = signed_at
    db.add(
        AuditLog(
            user_id=user.id,
            action_type="BATCH_SUBMIT",
            details={"completed": completed, "total": total, "final_pdf_key": pdf_key},
            client_ip=ip,
        )
    )
    await db.commit()
    await broadcaster.publish({"type": "BATCH_SUBMIT", "reviewer_code": user.reviewer_code, "ts": signed_at.isoformat()})
    return BatchSubmitResponse(status="locked", completed=completed, final_pdf_key=pdf_key)


@router.get("/{task_id}", response_model=TaskDetail)
async def get_task(
    task_id: uuid.UUID,
    user: User = Depends(agreed_reviewer),
    db: AsyncSession = Depends(get_db),
):
    task, ds = await _owned_task_or_404(db, user, task_id)
    task.last_accessed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(task)
    return _detail(task, ds)


@router.patch("/{task_id}/autosave", response_model=TaskMutationResponse)
async def autosave(
    task_id: uuid.UUID,
    body: AutosaveRequest,
    request: Request,
    user: User = Depends(ensure_not_locked),
    db: AsyncSession = Depends(get_db),
):
    task, _ = await _owned_task_or_404(db, user, task_id)
    _validate_version(task, body.version)
    task.draft_q = body.draft_q
    task.draft_a = body.draft_a
    task.error_reasons = [r.model_dump() for r in body.error_reasons]
    task.error_note = body.error_note
    task.last_accessed_at = datetime.now(timezone.utc)
    if task.status in ("pending", "completed"):
        task.status = "in_progress"
    task.version += 1
    db.add(
        AuditLog(
            user_id=user.id,
            action_type="AUTOSAVE",
            details={"task_id": str(task.id), "dataset_id": task.dataset_id, "version": task.version},
            client_ip=get_client_ip(request),
        )
    )
    await db.commit()
    return TaskMutationResponse(task_id=task.id, status=task.status, version=task.version)


@router.put("/{task_id}/submit", response_model=TaskMutationResponse)
async def submit(
    task_id: uuid.UUID,
    body: SubmitRequest,
    request: Request,
    user: User = Depends(ensure_not_locked),
    db: AsyncSession = Depends(get_db),
):
    task, ds = await _owned_task_or_404(db, user, task_id)
    _validate_version(task, body.version)
    try:
        active = verify_active_edit(ds.original_a, body.modified_a)
    except ActiveEditError as e:
        raise HTTPException(400, {"error_code": "ACTIVE_EDIT_REQUIRED", "message": str(e)})

    task.modified_q = body.modified_q
    task.modified_a = body.modified_a
    task.error_reasons = [r.model_dump() for r in body.error_reasons]
    task.error_note = body.error_note
    task.status = "completed"
    task.last_accessed_at = datetime.now(timezone.utc)
    task.submitted_at = task.last_accessed_at
    task.version += 1
    db.add(
        AuditLog(
            user_id=user.id,
            action_type="SUBMIT",
            details={
                "task_id": str(task.id),
                "dataset_id": task.dataset_id,
                "version": task.version,
                "active_edit": active,
            },
            client_ip=get_client_ip(request),
        )
    )
    await db.commit()
    return TaskMutationResponse(
        task_id=task.id,
        status=task.status,
        version=task.version,
        suspicious=active["suspicious"],
        active_edit=active,
    )
