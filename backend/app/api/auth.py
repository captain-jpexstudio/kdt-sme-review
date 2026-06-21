"""Auth 라우터 — spec §6/§12. 로그인·단일세션·동의(서명)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_reviewer, current_user, get_client_ip
from app.core.config import settings
from app.core.security import decode_token, make_access_token, make_refresh_token, verify_password
from app.db.base import get_db
from app.db.models import AgreementRecord, AuditLog, User
from app.schemas.auth import AgreementRequest, AuthState, LoginRequest
from app.services.pdf import PLEDGE_SHA256, render_and_store_pledge_pdf
from app.services.signature import SignatureError, store_signature
from app.services.storage import storage

REQUIRED_CONSENTS = ("security_copyright", "privacy", "tax")

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
async def agreement(
    body: AgreementRequest,
    request: Request,
    user: User = Depends(current_reviewer),
    db: AsyncSession = Depends(get_db),
):
    """동의 3종 + 듀얼 서명 → 검증·증빙 PDF → is_agreed=true (spec §6, BR-6/BR-11)."""
    if user.is_agreed:
        return {"status": "already_agreed"}
    if not all(body.checkbox_states.get(k) is True for k in REQUIRED_CONSENTS):
        raise HTTPException(400, {"error_code": "NOT_AGREED", "message": "필수 동의 3종을 모두 체크해야 합니다."})

    ip = get_client_ip(request)
    signed_at = datetime.now(timezone.utc)
    try:
        asset = await store_signature(db, storage, user.id, "agreement", body.typed_name, body.signature_png)
    except SignatureError as e:
        raise HTTPException(400, {"error_code": "SIGNATURE_REQUIRED", "message": str(e)})

    pdf_key = await render_and_store_pledge_pdf(
        storage, user, "agreement", asset, ip,
        typed_name=body.typed_name, signed_at=signed_at, signature_png_url=body.signature_png,
    )
    db.add(AgreementRecord(
        user_id=user.id, agreement_version=settings.AGREEMENT_VERSION, text_sha256=PLEDGE_SHA256,
        checkbox_states=body.checkbox_states, typed_name=body.typed_name,
        signature_asset_id=asset.id, pledge_pdf_key=pdf_key, client_ip=ip, agreed_at=signed_at,
    ))
    user.is_agreed = True
    db.add(AuditLog(user_id=user.id, action_type="AGREE_SIGN", details={"pdf": pdf_key}, client_ip=ip))
    await db.commit()
    return {"status": "ok"}
