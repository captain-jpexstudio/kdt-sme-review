"""Admin 라우터 — spec §12. P2 upload/assignment + P5 stubs."""
import os
import tempfile
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_admin
from app.db.base import get_db
from app.db.models import AuditLog, Dataset, Task, User
from app.schemas.tasks import DatasetUploadResponse
from app.services.assignment import build_assignments, load_xlsx

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


@router.get("/reviewers")
async def reviewers():
    return {"detail": "P5: reviewers"}


@router.get("/stats")
async def stats():
    return {"detail": "P5: stats"}


@router.get("/audit/stream")
async def audit_stream():
    return {"detail": "P5: SSE"}


@router.get("/export")
async def export(batch_id: str | None = None):
    return {"detail": "P5: export"}
