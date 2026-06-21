"""의존성 — 인증·세션·잠금 가드 (spec §6/§13.4)."""
import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decode_token
from app.db.base import get_db
from app.db.models import User


def get_client_ip(request: Request) -> str | None:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None


async def current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    """access 쿠키 JWT 디코드 + session_version 일치(단일 세션, BR-8)."""
    token = request.cookies.get(settings.ACCESS_COOKIE)
    if not token:
        raise HTTPException(401, {"error_code": "INVALID_CREDENTIALS", "message": "인증 필요"})
    try:
        payload = decode_token(token)
        user = await db.get(User, uuid.UUID(payload["sub"]))
    except Exception:
        raise HTTPException(401, {"error_code": "INVALID_CREDENTIALS", "message": "토큰 무효"})
    if user is None:
        raise HTTPException(401, {"error_code": "INVALID_CREDENTIALS"})
    if payload.get("sv") != user.session_version:
        raise HTTPException(401, {"error_code": "SESSION_SUPERSEDED", "message": "다른 기기 로그인으로 세션 무효"})
    return user


async def current_reviewer(user: User = Depends(current_user)) -> User:
    if user.role != "reviewer":
        raise HTTPException(403, {"error_code": "FORBIDDEN"})
    return user


async def agreed_reviewer(user: User = Depends(current_reviewer)) -> User:
    if not user.is_agreed:
        raise HTTPException(403, {"error_code": "NOT_AGREED", "message": "검수 참여 동의가 필요합니다."})
    return user


async def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, {"error_code": "FORBIDDEN"})
    return user


async def ensure_not_locked(user: User = Depends(agreed_reviewer)) -> User:
    """spec §13.4 — 최종 제출 후 편집 차단(423)."""
    if user.is_batch_submitted:
        raise HTTPException(423, {"error_code": "BATCH_LOCKED", "message": "최종 제출 완료로 편집이 잠겼습니다."})
    return user
