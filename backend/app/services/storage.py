"""파일 저장소 — 서명 PNG·증빙 PDF. P0: 로컬 볼륨 구현(spec §4.1, SIGNATURE_STORAGE)."""
from pathlib import Path

from app.core.config import settings


class LocalStorage:
    def __init__(self, root: str | None = None) -> None:
        self.root = Path(root or settings.SIGNATURE_STORAGE)

    async def put(self, key: str, data: bytes, mime: str = "application/octet-stream") -> str:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    async def get(self, key: str) -> bytes:
        return (self.root / key).read_bytes()


storage = LocalStorage()
