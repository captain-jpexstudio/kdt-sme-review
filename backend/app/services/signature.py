"""듀얼 서명 검증·저장 — spec §13.3. 공백 캔버스 검출 + sha256 자산화."""
import base64
import hashlib
import io

from PIL import Image

from app.core.config import settings


def decode_png(u: str) -> bytes:
    return base64.b64decode(u.split(",", 1)[1] if "," in u else u)


def is_blank(png: bytes) -> bool:
    img = Image.open(io.BytesIO(png)).convert("LA")
    img.thumbnail((300, 150))
    px = img.load()
    w, h = img.size
    ink = sum(1 for y in range(h) for x in range(w) if px[x, y][1] > 10 and px[x, y][0] < 200)
    return ink / (w * h) < settings.SIGN_MIN_INK_RATIO


class SignatureError(Exception):
    ...


def validate(typed_name: str, png_url: str) -> tuple[bytes, str]:
    """성명·캔버스 검증 → (png_bytes, sha256)."""
    if not (typed_name or "").strip():
        raise SignatureError("서명 성명을 입력하세요.")
    png = decode_png(png_url)
    if is_blank(png):
        raise SignatureError("서명(드로잉)이 비어 있습니다.")
    return png, hashlib.sha256(png).hexdigest()


async def store_signature(db, storage, user_id, kind: str, typed_name: str, png_url: str):
    """spec §13.3 — 검증 + 파일 저장 + signature_assets 1행. SignatureAsset 반환."""
    from app.db.models import SignatureAsset  # 지연 import(서비스↔모델 결합 최소화)

    png, sha = validate(typed_name, png_url)
    key = await storage.put(f"{kind}/{user_id}/{sha}.png", png, "image/png")
    asset = SignatureAsset(user_id=user_id, kind=kind, storage_key=key, sha256=sha, mime="image/png")
    db.add(asset)
    await db.flush()
    return asset
