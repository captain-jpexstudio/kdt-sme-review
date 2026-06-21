"""의존성 — 인증·세션·잠금 가드 (spec §6/§13.4). P0: 골격, 구현은 P1."""
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db


async def current_user(request: Request, db: AsyncSession = Depends(get_db)):
    """P1: 쿠키 JWT 디코드 + session_version 일치 확인 → User 반환."""
    raise HTTPException(501, {"error_code": "NOT_IMPLEMENTED", "message": "P1: 인증"})


async def current_reviewer(user=Depends(current_user)):  # noqa: ANN001
    if getattr(user, "role", None) != "reviewer":
        raise HTTPException(403, {"error_code": "FORBIDDEN"})
    return user


async def require_admin(user=Depends(current_user)):  # noqa: ANN001
    if getattr(user, "role", None) != "admin":
        raise HTTPException(403, {"error_code": "FORBIDDEN"})
    return user


async def ensure_not_locked(user=Depends(current_reviewer)):  # noqa: ANN001
    """spec §13.4 — 최종 제출 후 편집 차단(423)."""
    if getattr(user, "is_batch_submitted", False):
        raise HTTPException(423, {"error_code": "BATCH_LOCKED", "message": "최종 제출 완료로 편집이 잠겼습니다."})
    return user
