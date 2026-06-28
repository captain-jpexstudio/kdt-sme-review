"""증빙 PDF 렌더 — spec §13.3/§14. 서약 전문+서명+시각+IP 합성, 해시 보존."""
import hashlib
import re
from datetime import datetime

# 서약 전문(증빙 기준 텍스트). 출처: (주)JPEX STUDIO 동의·보안 서약서 v2.
# 이 문자열의 sha256(PLEDGE_SHA256)을 agreement_records.text_sha256에 고정해 무결성 증빙.
PLEDGE_TEXT = """[국방 데이터셋 자문 및 검수 참여 동의·보안 서약서]

본 서약서는 (주)JPEX STUDIO(이하 "회사")가 진행하는 국방 데이터셋 구축 프로젝트(이하 "본 프로젝트")에 전문 자문 및 검수 인력(이하 "검수자")으로 참여하는 자가 준수해야 할 보안, 저작권 귀속 및 개인정보 처리에 관한 사항을 규정함을 목적으로 합니다.

Part 1. 보안 서약 및 영업비밀 유지 동의 (필수)
본인은 본 프로젝트의 자문 및 검수를 수행함에 있어 다음의 보안 사항을 엄격히 준수할 것을 서약합니다.
(비밀유지 의무) 본인은 자문 및 검수 과정에서 제공받거나 알게 된 국방 관련 데이터, 문서, 가이드라인, 시스템 로직 등 일체의 정보가 「부정경쟁방지 및 영업비밀보호에 관한 법률」에 따른 회사의 중요한 영업비밀임을 인정하며, 이를 본 프로젝트의 수행 목적 외의 용도로 절대 사용하지 않습니다.
(유출 금지) 제공받은 모든 데이터 및 자문 내역을 회사의 사전 서면 승인 없이 외부로 유출, 복사, 전송, 배포, 캡처, 촬영하는 행위를 일체 금지합니다.
(파기 의무) 본 프로젝트가 종료되거나 회사의 요청이 있을 경우, 본인의 기기 및 저장 매체에 보관된 프로젝트 관련 모든 데이터를 즉시 복구 불가능한 방법으로 영구 삭제 및 파기합니다.
(손해배상 책임) 본 서약에 위반하여 데이터 유출 등 보안 사고를 발생시킨 경우, 민·형사상 모든 법적 책임(손해배상 등)을 감수합니다.
- 위 보안 서약 및 영업비밀 유지 내용에 동의합니다.

Part 2. 산출물 지식재산권 귀속 동의 (필수)
본인은 본 프로젝트 수행으로 인해 발생한 산출물에 대한 권리가 다음과 같이 처리됨에 동의합니다.
(권리의 귀속) 본인이 본 프로젝트의 자문 및 검수를 통해 생성, 수정, 보완, 제공한 모든 데이터, 의견서, 산출물, 2차적 저작물 등에 대한 저작재산권(복제권, 공연권, 공중송신권, 전시권, 배포권, 대여권, 2차적저작물작성권 등 일체) 및 지식재산권, 소유권은 산출물이 생성된 즉시 "회사"에 온전히, 그리고 영구적으로 귀속됩니다.
(권리 행사 제한) 본인은 해당 산출물을 자신의 포트폴리오, 연구, 상업적/비상업적 용도 등 어떠한 목적으로도 회사의 동의 없이 사용할 수 없으며, 저작인격권을 행사하지 않습니다.
- 위 지식재산권 귀속 내용에 동의합니다.

Part 3. 개인정보 수집 및 이용 동의 (필수)
회사는 「개인정보 보호법」 제15조(개인정보의 수집·이용) 등 관련 법령에 따라 자문 인력 관리 및 비용 지급을 위해 아래와 같이 개인정보를 수집 및 이용합니다.
수집 및 이용 목적: 자문 인력 본인 확인, 프로젝트 진행 안내 및 품질 관리, 작업 이력 증빙, 자문비(기타소득) 정산 및 지급
수집 항목: 성명, 연락처(휴대전화번호), 이메일, 은행 계좌정보(은행명, 예금주, 계좌번호)
보유 및 이용 기간: 프로젝트 종료 및 정산 완료 후 5년 보관 (「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 법령에 따른 의무 보존 기간)
동의 거부권: 본인은 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있으나, 거부 시 본 프로젝트 자문 참여 및 자문비 지급이 불가합니다.
- 위 개인정보 수집 및 이용에 동의합니다.

Part 4. 세무 신고(원천징수) 처리를 위한 사전 안내 (확인)
검수자에게 지급되는 대금은 전문적 지식 제공에 따른 자문비(기타소득) 성격으로, 「소득세법」 제127조 및 제145조에 의거하여 기타소득 원천징수 세율(8.8%)을 적용하여 세액을 공제한 후 지급됩니다. 이와 관련한 회사의 원천징수 의무 이행 및 국세청 세무 신고를 위해 주민등록번호 처리가 필수적으로 요구됩니다.
(수집 방식의 최소화) 정보 보안 및 개인정보 유출 방지를 위해 본 온라인 폼(시스템) 상에서는 주민등록번호를 수집하지 않습니다.
(유선 수집 및 즉시 파기) 세무 신고 시점에 맞추어 회사(또는 회사가 위탁한 세무대리인)가 유선 또는 별도의 보안 채널을 통해 1회에 한해 국세청 신고용 주민등록번호를 수집합니다. 수집된 정보는 「개인정보 보호법」 제24조의2(주민등록번호 처리의 제한)에 따라 원천징수 신고 목적 달성 즉시 복구 불가능한 방법으로 완전 파기함을 안내해 드립니다.
- 위 세무 신고(원천징수) 절차 및 주민등록번호 처리 방침을 확인하고 숙지하였습니다.
"""

PLEDGE_SHA256 = hashlib.sha256(PLEDGE_TEXT.encode("utf-8")).hexdigest()


def _esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _render_body(text: str) -> str:
    """PLEDGE_TEXT를 의미 단위로 포맷 — 문서 제목/Part 헤딩/조항/동의문구를 구조화."""
    blocks: list[str] = []
    for raw in text.strip().split("\n"):
        line = raw.strip()
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            blocks.append(f'<div class="doc-title">{_esc(line[1:-1])}</div>')
        elif line.startswith("Part "):
            blocks.append(f'<h2 class="part">{_esc(line)}</h2>')
        elif line.startswith("- "):
            blocks.append(f'<div class="consent">☑ {_esc(line[2:])}</div>')
        else:
            m = re.match(r"^(\([^)]+\))\s*(.*)$", line)  # "(라벨) 본문" → 라벨 굵게
            if m:
                blocks.append(f'<p class="clause"><b>{_esc(m.group(1))}</b> {_esc(m.group(2))}</p>')
            else:
                blocks.append(f'<p class="para">{_esc(line)}</p>')
    return "\n".join(blocks)


def _html(kind: str, typed_name: str, signed_at: datetime, ip: str | None,
          sig_sha: str, signature_png_url: str) -> str:
    badge = "검수 참여 동의·보안 서약" if kind == "agreement" else "최종 제출·저작권 이관 서명"
    body = _render_body(PLEDGE_TEXT)
    return f"""<html><head><meta charset="utf-8"><style>
      @page {{ margin: 26mm 20mm; }}
      body {{ font-family:'Noto Sans CJK KR',sans-serif; font-size:11px; line-height:1.7; color:#1f2937; }}
      .brand {{ font-size:10px; letter-spacing:1px; color:#1d6f61; font-weight:700; }}
      .badge {{ font-size:10px; color:#6b7280; margin-bottom:14px; }}
      .doc-title {{ font-size:16px; font-weight:700; margin:6px 0 14px; }}
      .part {{ font-size:12.5px; font-weight:700; margin:18px 0 6px; padding-bottom:4px; border-bottom:1px solid #e5e7eb; }}
      .para {{ margin:5px 0; }}
      .clause {{ margin:5px 0; padding-left:10px; }}
      .consent {{ margin:9px 0 4px; padding:7px 10px; background:#f1f7f5; border:1px solid #cfe3dc; border-radius:5px; font-weight:600; color:#145348; }}
      .meta {{ margin-top:26px; border-top:2px solid #1f2937; padding-top:12px; }}
      .meta p {{ margin:4px 0; }}
      .sig img {{ border:1px solid #d1d5db; border-radius:4px; max-width:280px; max-height:120px; background:#fff; }}
      .mono {{ font-family:monospace; font-size:9px; color:#6b7280; }}
    </style></head><body>
      <div class="brand">(주) JPEX STUDIO</div>
      <div class="badge">{badge}</div>
      {body}
      <div class="meta">
        <p>성명(타이핑): <b>{_esc(typed_name)}</b></p>
        <div class="sig">서명(드로잉):<br><img src="{signature_png_url}"></div>
        <p>서명 시각(UTC): {signed_at.isoformat()}</p>
        <p>IP: {_esc(ip or '-')}</p>
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
