"""Admin 라우터 — spec §12. P2 upload/assignment + P5 운영 API."""
import ast
import json
import os
import tempfile
import uuid
from io import BytesIO

import pandas as pd
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.api.deps import require_admin
from app.core.config import settings
from app.db.base import get_db
from app.db.models import AgreementRecord, AuditLog, BatchSubmission, Dataset, SignatureAsset, Task, User
from app.schemas.admin import (
    AdminStats,
    AdminTaskDiff,
    AdminTaskItem,
    AdminTaskList,
    DiffSide,
    RejectedItem,
    ReviewerProgress,
    SignatureInfo,
)
from app.schemas.tasks import DatasetUploadResponse
from app.services.active_edit import diff_stats
from app.services.assignment import build_assignments, load_xlsx
from app.services.events import broadcaster
from app.services.storage import storage

router = APIRouter(prefix="/admin", tags=["admin"])


def _cell(df, row, col: str) -> str | None:
    """xlsx 셀 → 정리된 문자열(없으면 None)."""
    if col not in df.columns:
        return None
    v = row.get(col)
    s = "" if v is None else str(v).strip()
    return s if s and s.lower() != "nan" else None


def _parse_list(v) -> list | None:
    """JSON/파이썬 리터럴 리스트 문자열 → list(실패 시 단일원소·None)."""
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    for fn in (json.loads, ast.literal_eval):
        try:
            r = fn(s)
            return r if isinstance(r, list) else [r]
        except Exception:
            pass
    return [s]


def _join_list(v) -> str | None:
    """리스트형 셀 → 줄바꿈 결합 텍스트(해설 저장용)."""
    lst = _parse_list(v)
    return "\n".join(str(x).strip() for x in lst if str(x).strip()) if lst else None


@router.post("/datasets/upload", response_model=DatasetUploadResponse)
async def upload_datasets(
    file: UploadFile = File(...),
    batch_id: str | None = None,
    per_reviewer: int = 300,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, {"error_code": "INVALID_FILE", "message": "xlsx 파일만 업로드할 수 있습니다."})

    reviewers = (
        await db.execute(
            select(User.id)
            .where(User.role == "reviewer")
            .order_by(User.reviewer_code, User.username)
        )
    ).scalars().all()
    if not reviewers:
        raise HTTPException(400, {"error_code": "NO_REVIEWERS", "message": "reviewer 계정이 없습니다."})

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        try:
            df = load_xlsx(tmp_path)
            status_col = (
                df["status"].fillna("main").astype(str).str.strip().str.lower()
                if "status" in df.columns else pd.Series(["main"] * len(df))
            )
            main_df = df[status_col == "main"].reset_index(drop=True)
            # 배정·개수검증은 main 문항 기준(reserved 예비분은 배정 제외).
            assignments = build_assignments(main_df, reviewers, per=per_reviewer)
        except ValueError as e:
            raise HTTPException(400, {"error_code": "INVALID_DATASET", "message": str(e)})

        bid = batch_id or f"batch-{uuid.uuid4().hex[:12]}"
        exists = (
            await db.execute(select(Dataset.id).where(Dataset.batch_id == bid).limit(1))
        ).scalar_one_or_none()
        if exists is not None:
            raise HTTPException(409, {"error_code": "BATCH_EXISTS", "message": "이미 업로드된 batch_id입니다."})

        datasets: list[Dataset] = []
        main_datasets: list[Dataset] = []
        for i, (_, row) in enumerate(df.iterrows()):
            st = str(status_col.iloc[i])
            ds = Dataset(
                source_id=_cell(df, row, "id"),
                original_q=str(row["question"]).strip(),
                original_a=str(row["answer"]).strip(),
                rationale=_join_list(row.get("rationale")) if "rationale" in df.columns else None,
                choices=_parse_list(row.get("choices")) if "choices" in df.columns else None,
                supporting_doctrine=_parse_list(row.get("supporting_doctrine")) if "supporting_doctrine" in df.columns else None,
                capability_category=_cell(df, row, "capability_category"),
                joint_domain=_cell(df, row, "joint_domain"),
                solver=_cell(df, row, "solver"),
                difficulty=_cell(df, row, "difficulty"),
                question_type=_cell(df, row, "question_type"),
                status=st,
                assigned_persona=_cell(df, row, "assigned_persona"),
                batch_id=bid,
            )
            db.add(ds)
            datasets.append(ds)
            if st == "main":
                main_datasets.append(ds)
        await db.flush()

        for row_idx, reviewer_id in assignments:
            db.add(Task(user_id=reviewer_id, dataset_id=main_datasets[row_idx].id))
        db.add(
            AuditLog(
                user_id=admin.id,
                action_type="DATASET_UPLOAD",
                details={
                    "batch_id": bid,
                    "datasets": len(datasets),
                    "reserved": len(datasets) - len(main_datasets),
                    "tasks": len(assignments),
                    "reviewers": len(reviewers),
                    "per_reviewer": per_reviewer,
                    "filename": file.filename,
                },
            )
        )
        await db.commit()
        return DatasetUploadResponse(
            batch_id=bid,
            datasets=len(datasets),
            reserved=len(datasets) - len(main_datasets),
            tasks=len(assignments),
            reviewers=len(reviewers),
            per_reviewer=per_reviewer,
        )
    finally:
        if tmp_path:
            os.unlink(tmp_path)


async def _reviewer_progress_rows(db: AsyncSession) -> list[ReviewerProgress]:
    users = (
        await db.execute(
            select(User)
            .where(User.role == "reviewer")
            .order_by(User.reviewer_code, User.username)
        )
    ).scalars().all()
    out: list[ReviewerProgress] = []
    for user in users:
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
        total = sum(counts.values())
        last_activity = (
            await db.execute(select(func.max(Task.last_accessed_at)).where(Task.user_id == user.id))
        ).scalar_one_or_none()
        submit_logs = (
            await db.execute(
                select(AuditLog.details)
                .where(and_(AuditLog.user_id == user.id, AuditLog.action_type == "SUBMIT"))
            )
        ).scalars().all()
        ratios = [
            float((details or {}).get("active_edit", {}).get("change_ratio"))
            for details in submit_logs
            if (details or {}).get("active_edit", {}).get("change_ratio") is not None
        ]
        trivial_count = sum(
            1
            for details in submit_logs
            if (details or {}).get("active_edit", {}).get("suspicious") is True
        )
        out.append(
            ReviewerProgress(
                user_id=user.id,
                username=user.username,
                reviewer_code=user.reviewer_code,
                total=total,
                completed=counts["completed"],
                in_progress=counts["in_progress"],
                pending=counts["pending"],
                progress_pct=(counts["completed"] / total * 100) if total else 0,
                locked=user.is_batch_submitted,
                batch_submitted_at=user.batch_submitted_at,
                last_activity_at=last_activity,
                avg_change_ratio=(sum(ratios) / len(ratios)) if ratios else None,
                trivial_count=trivial_count,
            )
        )
    return out


@router.get("/reviewers", response_model=list[ReviewerProgress])
async def reviewers(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):  # noqa: ARG001
    return await _reviewer_progress_rows(db)


@router.get("/stats", response_model=AdminStats)
async def stats(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):  # noqa: ARG001
    rows = (await db.execute(select(Task.status, func.count()).group_by(Task.status))).all()
    counts = {"pending": 0, "in_progress": 0, "completed": 0}
    for status, count in rows:
        counts[status] = count
    total = sum(counts.values())
    reviewers_count = (await db.execute(select(func.count()).select_from(User).where(User.role == "reviewer"))).scalar_one()
    locked = (
        await db.execute(
            select(func.count()).select_from(User).where(and_(User.role == "reviewer", User.is_batch_submitted.is_(True)))
        )
    ).scalar_one()
    return AdminStats(
        reviewers=reviewers_count,
        total_tasks=total,
        completed=counts["completed"],
        in_progress=counts["in_progress"],
        pending=counts["pending"],
        locked_reviewers=locked,
        progress_pct=(counts["completed"] / total * 100) if total else 0,
    )


@router.get("/audit/stream")
async def audit_stream(admin: User = Depends(require_admin)):  # noqa: ARG001
    async def events():
        async for event in broadcaster.subscribe():
            yield {"event": event.get("type", "AUDIT"), "data": json.dumps(event, ensure_ascii=False)}

    return EventSourceResponse(events())


@router.get("/export")
async def export(
    batch_id: str | None = None,
    admin: User = Depends(require_admin),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(
            User.reviewer_code,
            Dataset.batch_id,
            Dataset.id,
            Dataset.original_q,
            Dataset.original_a,
            Task.modified_q,
            Task.modified_a,
            Task.error_reasons,
            Task.error_note,
            Task.submitted_at,
            Dataset.capability_category,
            Dataset.joint_domain,
            Dataset.difficulty,
            Dataset.question_type,
            Dataset.rationale,
        )
        .join(Task, Task.user_id == User.id)
        .join(Dataset, Dataset.id == Task.dataset_id)
        .where(Task.status == "completed")
        .order_by(User.reviewer_code, Dataset.id)
    )
    if batch_id:
        stmt = stmt.where(Dataset.batch_id == batch_id)
    rows = (await db.execute(stmt)).all()
    data = [
        {
            "reviewer_code": r[0],
            "batch_id": r[1],
            "dataset_id": r[2],
            "capability_category": r[10],
            "joint_domain": r[11],
            "difficulty": r[12],
            "question_type": r[13],
            "original_q": r[3],
            "original_a": r[4],
            "modified_q": r[5],
            "modified_a": r[6],
            "rationale_cot": r[14],
            "error_reasons": json.dumps(r[7] or [], ensure_ascii=False),
            "error_note": r[8],
            "submitted_at": r[9].isoformat() if r[9] else None,
        }
        for r in rows
    ]
    buf = BytesIO()
    pd.DataFrame(data).to_excel(buf, index=False)
    buf.seek(0)
    suffix = batch_id or "all"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="kdt-review-export-{suffix}.xlsx"'},
    )


@router.post("/users/{user_id}/unlock")
async def unlock_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if user is None or user.role != "reviewer":
        raise HTTPException(404, {"error_code": "NOT_FOUND"})
    user.is_batch_submitted = False
    user.batch_submitted_at = None
    db.add(AuditLog(user_id=admin.id, action_type="BATCH_UNLOCK", details={"target_user_id": str(user.id), "reviewer_code": user.reviewer_code}))
    await db.commit()
    await broadcaster.publish({"type": "BATCH_UNLOCK", "reviewer_code": user.reviewer_code})
    return {"status": "unlocked"}


@router.get("/users/{user_id}/signatures", response_model=list[SignatureInfo])
async def signatures(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    return (
        await db.execute(
            select(SignatureAsset)
            .where(SignatureAsset.user_id == user_id)
            .order_by(SignatureAsset.created_at.desc())
        )
    ).scalars().all()


@router.get("/signatures/{asset_id}/image")
async def signature_image(
    asset_id: int,
    admin: User = Depends(require_admin),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    asset = await db.get(SignatureAsset, asset_id)
    if asset is None:
        raise HTTPException(404, {"error_code": "NOT_FOUND"})
    return Response(await storage.get(asset.storage_key), media_type=asset.mime or "image/png")


@router.get("/users/{user_id}/agreement.pdf")
async def agreement_pdf(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    key = (
        await db.execute(
            select(AgreementRecord.pledge_pdf_key)
            .where(AgreementRecord.user_id == user_id)
            .order_by(AgreementRecord.agreed_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if not key:
        raise HTTPException(404, {"error_code": "NOT_FOUND"})
    return Response(await storage.get(key), media_type="application/pdf")


@router.get("/users/{user_id}/final.pdf")
async def final_pdf(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    key = (
        await db.execute(
            select(BatchSubmission.final_pdf_key)
            .where(BatchSubmission.user_id == user_id)
            .order_by(BatchSubmission.submitted_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if not key:
        raise HTTPException(404, {"error_code": "NOT_FOUND"})
    return Response(await storage.get(key), media_type="application/pdf")


def _q_preview(text: str, limit: int = 80) -> str:
    s = " ".join((text or "").split())
    return s if len(s) <= limit else s[: limit - 1] + "…"


@router.get("/rejected", response_model=list[RejectedItem])
async def rejected_items(
    batch_id: str | None = None,
    admin: User = Depends(require_admin),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    """폐기(reject)된 문항 목록 — 검수자·문항번호·사유."""
    stmt = (
        select(Task, Dataset, User)
        .join(Dataset, Dataset.id == Task.dataset_id)
        .join(User, User.id == Task.user_id)
        .where(Task.status == "rejected")
    )
    if batch_id:
        stmt = stmt.where(Dataset.batch_id == batch_id)
    stmt = stmt.order_by(Task.submitted_at.desc().nullslast())
    rows = (await db.execute(stmt)).all()
    return [
        RejectedItem(
            task_id=t.id,
            reviewer_code=u.reviewer_code,
            reviewer_username=u.username,
            source_id=d.source_id,
            question_preview=_q_preview(d.original_q),
            reason=t.error_note,
            batch_id=d.batch_id,
            rejected_at=t.submitted_at,
        )
        for t, d, u in rows
    ]


def _task_edit_stats(dataset: Dataset, task: Task) -> tuple[str | None, dict | None]:
    """검토 대상 정답(제출본 우선, 없으면 임시저장본)과 원본 대비 diff 통계."""
    answer = task.modified_a or task.draft_a
    if not answer:
        return None, None
    return answer, diff_stats(dataset.original_a, answer)


@router.get("/tasks", response_model=AdminTaskList)
async def admin_tasks(
    user_id: uuid.UUID | None = None,
    status: str | None = None,
    suspicious: bool | None = None,
    tagged: bool | None = None,
    batch_id: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
    admin: User = Depends(require_admin),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    """관리자 문항 목록 — spec §10 필터/대조. 검수자·상태·의심·오류태깅 필터 + 변경률 분포."""
    page = max(page, 1)
    page_size = min(max(page_size, 1), 500)  # 500 = 검수자 1인분(300) 전체를 한 페이지로

    stmt = (
        select(Task, Dataset, User.reviewer_code)
        .join(Dataset, Dataset.id == Task.dataset_id)
        .join(User, User.id == Task.user_id)
        .where(User.role == "reviewer")
        .order_by(User.reviewer_code, Dataset.id)
    )
    if user_id:
        stmt = stmt.where(Task.user_id == user_id)
    if status:
        stmt = stmt.where(Task.status == status)
    if batch_id:
        stmt = stmt.where(Dataset.batch_id == batch_id)
    if q:
        stmt = stmt.where(Dataset.original_q.ilike(f"%{q}%"))
    rows = (await db.execute(stmt)).all()

    items: list[AdminTaskItem] = []
    histogram = [0] * 10
    for t, d, code in rows:
        answer, stats = _task_edit_stats(d, t)
        edited = bool(stats and not stats["identical"])
        ratio = stats["change_ratio"] if stats else None
        is_suspicious = bool(edited and ratio is not None and ratio < settings.SUSPICIOUS_RATIO)
        is_tagged = bool(t.error_reasons) or bool(t.error_note)
        if suspicious is not None and is_suspicious != suspicious:
            continue
        if tagged is not None and is_tagged != tagged:
            continue
        q_changed = bool(t.modified_q or t.draft_q) and not diff_stats(d.original_q, t.modified_q or t.draft_q)["identical"]
        if t.status == "completed" and ratio is not None:
            histogram[min(int(ratio * 10), 9)] += 1
        items.append(
            AdminTaskItem(
                task_id=t.id,
                user_id=t.user_id,
                reviewer_code=code,
                dataset_id=d.id,
                source_id=d.source_id,
                question_type=d.question_type,
                q_preview=_q_preview(d.original_q),
                status=t.status,
                edited=edited,
                q_changed=q_changed,
                change_ratio=ratio,
                suspicious=is_suspicious,
                tagged=is_tagged,
                submitted_at=t.submitted_at,
                last_accessed_at=t.last_accessed_at,
            )
        )
    total = len(items)
    suspicious_total = sum(1 for it in items if it.suspicious)
    start = (page - 1) * page_size
    return AdminTaskList(
        items=items[start : start + page_size],
        total=total,
        page=page,
        page_size=page_size,
        ratio_histogram=histogram,
        suspicious_total=suspicious_total,
    )


@router.get("/tasks/{task_id}/diff", response_model=AdminTaskDiff)
async def admin_task_diff(
    task_id: uuid.UUID,
    admin: User = Depends(require_admin),  # noqa: ARG001
    db: AsyncSession = Depends(get_db),
):
    """원본↔수정 대조 — spec §10 DiffViewer 데이터."""
    row = (
        await db.execute(
            select(Task, Dataset, User.reviewer_code)
            .join(Dataset, Dataset.id == Task.dataset_id)
            .join(User, User.id == Task.user_id)
            .where(Task.id == task_id)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(404, {"error_code": "NOT_FOUND"})
    t, d, code = row

    def side(original: str, modified: str | None) -> DiffSide:
        if not modified:
            return DiffSide(original=original)
        s = diff_stats(original, modified)
        return DiffSide(
            original=original,
            modified=modified,
            changed_words=s["changed_words"],
            change_ratio=s["change_ratio"],
            identical=s["identical"],
        )

    answer_side = side(d.original_a, t.modified_a or t.draft_a)
    return AdminTaskDiff(
        task_id=t.id,
        reviewer_code=code,
        status=t.status,
        question_type=d.question_type,
        source_id=d.source_id,
        question=side(d.original_q, t.modified_q or t.draft_q),
        answer=answer_side,
        suspicious=bool(not answer_side.identical and answer_side.modified and answer_side.change_ratio < settings.SUSPICIOUS_RATIO),
        choices=d.choices,
        rationale=d.rationale,
        error_reasons=t.error_reasons,
        error_note=t.error_note,
        submitted_at=t.submitted_at,
    )


@router.post("/tasks/{task_id}/restore")
async def restore_task(
    task_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """폐기 문항 복원 — rejected→pending. 폐기 시 자동배정된 예비 대체분이 미착수(pending·무편집)면 회수(개수 유지)."""
    task = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()
    if task is None or task.status != "rejected":
        raise HTTPException(404, {"error_code": "NOT_REJECTED", "message": "폐기된 문항이 아닙니다."})

    log = (
        await db.execute(
            select(AuditLog)
            .where(AuditLog.action_type == "REJECT", AuditLog.details["task_id"].astext == str(task_id))
            .order_by(AuditLog.id.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    recovered = False
    if log and (log.details or {}).get("replacement_task_id"):
        rep = (
            await db.execute(select(Task).where(Task.id == uuid.UUID(log.details["replacement_task_id"])))
        ).scalar_one_or_none()
        if rep is not None and rep.status == "pending" and not rep.draft_a and not rep.modified_a:
            await db.delete(rep)  # 예비 dataset(status=reserved) 그대로 → 다시 미배정 예비로 회수
            recovered = True

    task.status = "pending"
    task.submitted_at = None
    task.error_note = None        # 폐기 사유 제거(복원 후 검수자 메모에 잔존 방지)
    task.error_reasons = None
    task.draft_q = None
    task.draft_a = None
    task.version += 1
    db.add(
        AuditLog(
            user_id=admin.id,
            action_type="RESTORE",
            details={"task_id": str(task_id), "replacement_recovered": recovered},
        )
    )
    await db.commit()
    return {"ok": True, "replacement_recovered": recovered}
