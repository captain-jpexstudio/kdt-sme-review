"""PII 암호화 — Fernet (spec §14). real_name/phone/bank_* at-rest 암호화."""
from cryptography.fernet import Fernet

from app.core.config import settings

_fernet: Fernet | None = None


def _f() -> Fernet:
    global _fernet
    if _fernet is None:
        if not settings.PII_FERNET_KEY:
            raise RuntimeError("PII_FERNET_KEY 미설정")
        _fernet = Fernet(settings.PII_FERNET_KEY.encode())
    return _fernet


def encrypt(plain: str) -> bytes:
    return _f().encrypt(plain.encode())


def decrypt(token: bytes) -> str:
    return _f().decrypt(token).decode()
