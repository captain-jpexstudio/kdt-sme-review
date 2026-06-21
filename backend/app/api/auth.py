"""Auth 라우터 — spec §12. P0: 경로 골격(501)."""
from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login():
    return {"detail": "P1: login"}


@router.post("/logout")
async def logout():
    return {"detail": "P1: logout"}


@router.post("/refresh")
async def refresh():
    return {"detail": "P1: refresh"}


@router.get("/me")
async def me():
    return {"detail": "P1: me"}


@router.post("/agreement")
async def agreement():
    return {"detail": "P1: 동의 + 듀얼 서명"}
