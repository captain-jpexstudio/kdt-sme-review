"""FastAPI 엔트리 — spec §4. P0: 앱 기동 + 라우터 마운트 + health."""
from fastapi import FastAPI

from app.api import admin, auth, tasks

app = FastAPI(title="Survey Web — SME 검수앱", version="0.1.0")

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(tasks.router, prefix=API_PREFIX)
app.include_router(admin.router, prefix=API_PREFIX)


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
