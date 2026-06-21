"""Reviewer 검수 라우터 — spec §12. P0: 경로 골격(P2~P4 구현)."""
from fastapi import APIRouter

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/summary")
async def summary():
    return {"detail": "P2: summary"}


@router.get("/list")
async def list_tasks(status: str | None = None, q: str | None = None, sort: str | None = None):
    return {"detail": "P2: list"}


@router.get("/resume")
async def resume():
    return {"detail": "P3: resume"}


@router.get("/batch/eligibility")
async def batch_eligibility():
    return {"detail": "P4: eligibility"}


@router.post("/batch-submit")
async def batch_submit():
    return {"detail": "P4: batch-submit"}


@router.get("/{task_id}")
async def get_task(task_id: str):
    return {"detail": "P2: get", "task_id": task_id}


@router.patch("/{task_id}/autosave")
async def autosave(task_id: str):
    return {"detail": "P2: autosave"}


@router.put("/{task_id}/submit")
async def submit(task_id: str):
    return {"detail": "P2: submit (ActiveEdit 검증)"}
