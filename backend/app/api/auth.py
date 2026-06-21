"""Auth 라우터 — spec §6/§12. 로그인·단일세션·동의(서명)."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user, get_client_ip
from app.core.config import settings
from app.core.security import decode_token, make_access_token, make_refresh_token, verify_password
from app.db.base import get_db
from app.db.models import AuditLog, User
from app.schemas.auth import AuthState, LoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookies(resp: Response, user: User) -> None:
    access = make_access_token(str(user.id), user.role, user.session_version)
    refresh = make_refresh_token(str(user.id), user.session_version)
    common = {"httponly": True, "secure": settings.COOKIE_SECURE, "samesite": "lax"}
    resp.set_cookie(settings.ACCESS_COOKIE, access, max_age=settings.JWT_ACCESS_TTL_MIN * 60, **common)
    resp.set_cookie(settings.REFRESH_COOKIE, refresh, max_age=settings.JWT_REFRESH_TTL_DAYS * 86400, **common)


def _state(user: User) -> AuthState:
    return AuthState(role=user.role, is_agreed=user.is_agreed, is_batch_submitted=user.is_batch_submitted)


@router.post("/login", response_model=AuthState)
async def login(body: LoginRequest, request: Request, resp: Response, db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.username == body.username))).scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, {"error_code": "INVALID_CREDENTIALS", "message": "아이디 또는 비밀번호 오류"})
    user.session_version += 1  # 단일 세션(BR-8): 기존 세션 무효화
    db.add(AuditLog(user_id=user.id, action_type="LOGIN", client_ip=get_client_ip(request)))
    await db.commit()
    _set_auth_cookies(resp, user)
    return _state(user)


@router.post("/logout")
async def logout(resp: Response):
    resp.delete_cookie(settings.ACCESS_COOKIE)
    resp.delete_cookie(settings.REFRESH_COOKIE)
    return {"status": "ok"}


@router.post("/refresh", response_model=AuthState)
async def refresh(request: Request, resp: Response, db: AsyncSession = Depends(get_db)):
    token = request.cookies.get(settings.REFRESH_COOKIE)
    if not token:
        raise HTTPException(401, {"error_code": "INVALID_CREDENTIALS"})
    try:
        import uuid
        payload = decode_token(token)
        user = await db.get(User, uuid.UUID(payload["sub"]))
    except Exception:
        raise HTTPException(401, {"error_code": "INVALID_CREDENTIALS"})
    if user is None or payload.get("sv") != user.session_version:
        raise HTTPException(401, {"error_code": "SESSION_SUPERSEDED"})
    _set_auth_cookies(resp, user)
    return _state(user)


@router.get("/me", response_model=AuthState)
async def me(user: User = Depends(current_user)):
    return _state(user)


@router.post("/agreement")
async def agreement():
    return {"detail": "P1-②: 동의 + 듀얼 서명 (다음 커밋)"}
