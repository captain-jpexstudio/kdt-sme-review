"""Admin 라우터 — spec §12. P0: 경로 골격(P2/P5 구현)."""
from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/datasets/upload")
async def upload_datasets():
    return {"detail": "P2: xlsx 업로드·할당"}


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
