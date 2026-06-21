"""증빙 PDF 렌더 — spec §13.3/§14. 서약 전문+서명+시각+IP 합성, 해시 보존."""
import hashlib
from datetime import datetime

# 서약 전문(증빙 기준 텍스트). 출처: 사용자 동의양식.md(보안서약·저작권·개인정보·세무).
PLEDGE_TEXT = """[데이터셋 검수 참여 동의 및 보안 서약서]

Part 1. 보안 서약 및 산출물 저작권 동의
- 제공받은 모든 데이터·문서·기술 정보를 작업 목적 외로 사용하지 않으며 외부에 유출·복사·전송·배포하지 않는다.
- 본인의 검수로 생성·수정·가공된 모든 데이터 및 산출물의 지식재산권·소유권은 주최 측에 완전히 귀속된다.

Part 2. 개인정보 수집 및 이용 동의(필수)
- 본인 확인·안내, 품질관리·이력 증빙, 검수비 지급을 위해 개인정보 수집·이용에 동의한다.

Part 3. 세무 신고(원천징수) 사전 안내
- 주민등록번호는 본 폼에서 수집하지 않으며, 필요 시 유선으로 1회 수집·신고 즉시 파기됨을 확인한다.
"""

PLEDGE_SHA256 = hashlib.sha256(PLEDGE_TEXT.encode("utf-8")).hexdigest()


def _html(kind: str, typed_name: str, signed_at: datetime, ip: str | None,
          sig_sha: str, signature_png_url: str) -> str:
    title = "검수 참여 동의·보안 서약" if kind == "agreement" else "최종 제출·저작권 이관 서명"
    body = PLEDGE_TEXT.replace("\n", "<br>")
    return f"""<html><head><meta charset="utf-8"><style>
      body{{font-family:'Noto Sans CJK KR',sans-serif;font-size:12px;color:#222;padding:28px}}
      h1{{font-size:16px}} .meta{{margin-top:18px;border-top:1px solid #ccc;padding-top:10px}}
      .sig img{{border:1px solid #ccc;max-width:280px;max-height:120px}}
      .mono{{font-family:monospace;font-size:10px;color:#555}}
    </style></head><body>
      <h1>{title}</h1>
      <div>{body}</div>
      <div class="meta">
        <p>성명(타이핑): <b>{typed_name}</b></p>
        <div class="sig">서명(드로잉):<br><img src="{signature_png_url}"></div>
        <p>서명 시각(UTC): {signed_at.isoformat()}</p>
        <p>IP: {ip or '-'}</p>
        <p class="mono">서명 PNG sha256: {sig_sha}</p>
        <p class="mono">서약 전문 sha256: {PLEDGE_SHA256}</p>
      </div>
    </body></html>"""


async def render_and_store_pledge_pdf(storage, user, kind: str, asset, ip: str | None,
                                      *, typed_name: str, signed_at: datetime,
                                      signature_png_url: str) -> str:
    """합성 PDF 렌더 후 저장. storage_key 반환."""
    from weasyprint import HTML  # 무거운 네이티브 의존 → 지연 import

    html = _html(kind, typed_name, signed_at, ip, asset.sha256, signature_png_url)
    pdf_bytes = HTML(string=html).write_pdf()
    return await storage.put(f"{kind}/{user.id}/pledge_{asset.sha256}.pdf", pdf_bytes, "application/pdf")
