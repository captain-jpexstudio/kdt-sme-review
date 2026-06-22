"""Admin 라우터 — spec §12. P2 upload/assignment + P5 운영 API."""
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
from app.db.base import get_db
from app.db.models import AgreementRecord, AuditLog, BatchSubmission, Dataset, SignatureAsset, Task, User
from app.schemas.admin import AdminStats, ReviewerProgress, SignatureInfo
from app.schemas.tasks import DatasetUploadResponse
from app.services.assignment import build_assignments, load_xlsx
from app.services.events import broadcaster
from app.services.storage import storage

router = APIRouter(prefix="/admin", tags=["admin"])


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
            assignments = build_assignments(df, reviewers, per=per_reviewer)
        except ValueError as e:
            raise HTTPException(400, {"error_code": "INVALID_DATASET", "message": str(e)})

        bid = batch_id or f"batch-{uuid.uuid4().hex[:12]}"
        exists = (
            await db.execute(select(Dataset.id).where(Dataset.batch_id == bid).limit(1))
        ).scalar_one_or_none()
        if exists is not None:
            raise HTTPException(409, {"error_code": "BATCH_EXISTS", "message": "이미 업로드된 batch_id입니다."})

        datasets: list[Dataset] = []
        for _, row in df.iterrows():
            ds = Dataset(
                original_q=str(row["question"]).strip(),
                original_a=str(row["answer"]).strip(),
                assigned_persona=None if "assigned_persona" not in df.columns else str(row.get("assigned_persona") or "").strip() or None,
                batch_id=bid,
            )
            db.add(ds)
            datasets.append(ds)
        await db.flush()

        for row_idx, reviewer_id in assignments:
            db.add(Task(user_id=reviewer_id, dataset_id=datasets[row_idx].id))
        db.add(
            AuditLog(
                user_id=admin.id,
                action_type="DATASET_UPLOAD",
                details={
                    "batch_id": bid,
                    "datasets": len(datasets),
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
        select(User.reviewer_code, Dataset.batch_id, Dataset.id, Dataset.original_q, Dataset.original_a, Task.modified_q, Task.modified_a, Task.error_reasons, Task.error_note, Task.submitted_at)
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
            "original_q": r[3],
            "original_a": r[4],
            "modified_q": r[5],
            "modified_a": r[6],
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
