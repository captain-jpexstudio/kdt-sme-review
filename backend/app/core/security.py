"""인증 헬퍼 — JWT + bcrypt (spec §6). P0: 토큰 발급/검증 골격."""
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    return _pwd.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return _pwd.verify(raw, hashed)


def make_access_token(sub: str, role: str, sv: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": sub,
        "role": role,
        "sv": sv,
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_TTL_MIN),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def make_refresh_token(sub: str, sv: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": sub, "sv": sv, "iat": now, "exp": now + timedelta(days=settings.JWT_REFRESH_TTL_DAYS)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
