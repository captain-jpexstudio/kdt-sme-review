"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SignaturePad, type SignatureValue } from "@/components/SignaturePad";
import { postAgreement } from "@/lib/auth";
import { useIsMobile } from "@/lib/useIsMobile";
import { c, radius, shadow } from "@/lib/theme";

type ConsentKey = "security" | "ip_rights" | "privacy" | "tax";

interface Clause {
  label?: string;
  text: string;
}

interface Part {
  key: ConsentKey;
  no: number;
  title: string;
  badge: "필수" | "확인";
  intro: string;
  clauses?: Clause[];
  rows?: { label: string; text: string }[];
  consent: string;
}

const PARTS: Part[] = [
  {
    key: "security",
    no: 1,
    title: "보안 서약 및 영업비밀 유지 동의",
    badge: "필수",
    intro: "본인은 본 프로젝트의 자문 및 검수를 수행함에 있어 다음의 보안 사항을 엄격히 준수할 것을 서약합니다.",
    clauses: [
      { label: "비밀유지 의무", text: "본인은 자문 및 검수 과정에서 제공받거나 알게 된 국방 관련 데이터, 문서, 가이드라인, 시스템 로직 등 일체의 정보가 「부정경쟁방지 및 영업비밀보호에 관한 법률」에 따른 회사의 중요한 영업비밀임을 인정하며, 이를 본 프로젝트의 수행 목적 외의 용도로 절대 사용하지 않습니다." },
      { label: "유출 금지", text: "제공받은 모든 데이터 및 자문 내역을 회사의 사전 서면 승인 없이 외부로 유출, 복사, 전송, 배포, 캡처, 촬영하는 행위를 일체 금지합니다." },
      { label: "파기 의무", text: "본 프로젝트가 종료되거나 회사의 요청이 있을 경우, 본인의 기기 및 저장 매체에 보관된 프로젝트 관련 모든 데이터를 즉시 복구 불가능한 방법으로 영구 삭제 및 파기합니다." },
      { label: "손해배상 책임", text: "본 서약에 위반하여 데이터 유출 등 보안 사고를 발생시킨 경우, 민·형사상 모든 법적 책임(손해배상 등)을 감수합니다." },
    ],
    consent: "위 보안 서약 및 영업비밀 유지 내용에 동의합니다.",
  },
  {
    key: "ip_rights",
    no: 2,
    title: "산출물 지식재산권 귀속 동의",
    badge: "필수",
    intro: "본인은 본 프로젝트 수행으로 인해 발생한 산출물에 대한 권리가 다음과 같이 처리됨에 동의합니다.",
    clauses: [
      { label: "권리의 귀속", text: "본인이 본 프로젝트의 자문 및 검수를 통해 생성, 수정, 보완, 제공한 모든 데이터, 의견서, 산출물, 2차적 저작물 등에 대한 저작재산권(복제권, 공연권, 공중송신권, 전시권, 배포권, 대여권, 2차적저작물작성권 등 일체) 및 지식재산권, 소유권은 산출물이 생성된 즉시 “회사”에 온전히, 그리고 영구적으로 귀속됩니다." },
      { label: "권리 행사 제한", text: "본인은 해당 산출물을 자신의 포트폴리오, 연구, 상업적/비상업적 용도 등 어떠한 목적으로도 회사의 동의 없이 사용할 수 없으며, 저작인격권을 행사하지 않습니다." },
    ],
    consent: "위 지식재산권 귀속 내용에 동의합니다.",
  },
  {
    key: "privacy",
    no: 3,
    title: "개인정보 수집 및 이용 동의",
    badge: "필수",
    intro: "회사는 「개인정보 보호법」 제15조(개인정보의 수집·이용) 등 관련 법령에 따라 자문 인력 관리 및 비용 지급을 위해 아래와 같이 개인정보를 수집 및 이용합니다.",
    rows: [
      { label: "수집 및 이용 목적", text: "자문 인력 본인 확인, 프로젝트 진행 안내 및 품질 관리, 작업 이력 증빙, 자문비(기타소득) 정산 및 지급" },
      { label: "수집 항목", text: "성명, 연락처(휴대전화번호), 이메일, 은행 계좌정보(은행명, 예금주, 계좌번호)" },
      { label: "보유 및 이용 기간", text: "프로젝트 종료 및 정산 완료 후 5년 보관 (「전자상거래 등에서의 소비자보호에 관한 법률」 등 관계 법령에 따른 의무 보존 기간)" },
      { label: "동의 거부권", text: "본인은 개인정보 수집 및 이용에 대한 동의를 거부할 권리가 있으나, 거부 시 본 프로젝트 자문 참여 및 자문비 지급이 불가합니다." },
    ],
    consent: "위 개인정보 수집 및 이용에 동의합니다.",
  },
  {
    key: "tax",
    no: 4,
    title: "세무 신고(원천징수) 처리를 위한 사전 안내",
    badge: "확인",
    intro: "검수자에게 지급되는 대금은 전문적 지식 제공에 따른 자문비(기타소득) 성격으로, 「소득세법」 제127조 및 제145조에 의거하여 기타소득 원천징수 세율(8.8%)을 적용하여 세액을 공제한 후 지급됩니다. 이와 관련한 회사의 원천징수 의무 이행 및 국세청 세무 신고를 위해 주민등록번호 처리가 필수적으로 요구됩니다.",
    clauses: [
      { label: "수집 방식의 최소화", text: "정보 보안 및 개인정보 유출 방지를 위해 본 온라인 폼(시스템) 상에서는 주민등록번호를 수집하지 않습니다." },
      { label: "유선 수집 및 즉시 파기", text: "세무 신고 시점에 맞추어 회사(또는 회사가 위탁한 세무대리인)가 유선 또는 별도의 보안 채널을 통해 1회에 한해 국세청 신고용 주민등록번호를 수집합니다. 수집된 정보는 「개인정보 보호법」 제24조의2(주민등록번호 처리의 제한)에 따라 원천징수 신고 목적 달성 즉시 복구 불가능한 방법으로 완전 파기함을 안내해 드립니다." },
    ],
    consent: "위 세무 신고(원천징수) 절차 및 주민등록번호 처리 방침을 확인하고 숙지하였습니다.",
  },
];

const INITIAL = { security: false, ip_rights: false, privacy: false, tax: false };

export default function AgreementPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [checks, setChecks] = useState<Record<ConsentKey, boolean>>(INITIAL);
  const [sig, setSig] = useState<SignatureValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allChecked = PARTS.every((p) => checks[p.key]);
  const canSubmit = allChecked && sig !== null;

  const toggleAll = (v: boolean) => setChecks({ security: v, ip_rights: v, privacy: v, tax: v });

  const onSubmit = async () => {
    if (!canSubmit || !sig) return;
    setBusy(true);
    setError(null);
    try {
      await postAgreement({ typed_name: sig.typedName, signature_png: sig.png, checkbox_states: checks });
      router.push("/workspace");
    } catch {
      setError("동의 제출에 실패했습니다. 모든 항목 체크와 서명을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={isMobile ? pageMobile : page}>
      <div style={isMobile ? cardMobile : card}>
        <div style={brand}>(주) JPEX STUDIO</div>
        <h1 style={docTitle}>국방 데이터셋 자문 및 검수 참여 동의·보안 서약서</h1>
        <p style={lead}>
          본 서약서는 (주)JPEX STUDIO(이하 “회사”)가 진행하는 국방 데이터셋 구축 프로젝트(이하 “본 프로젝트”)에
          전문 자문 및 검수 인력(이하 “검수자”)으로 참여하는 자가 준수해야 할 보안, 저작권 귀속 및 개인정보 처리에 관한
          사항을 규정함을 목적으로 합니다.
        </p>

        <label style={allRow}>
          <input type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)} style={cbAll} />
          <span>약관 전체에 동의합니다 <span style={allHint}>(필수 항목 포함 4건)</span></span>
        </label>

        {PARTS.map((p) => (
          <section key={p.key} style={partBox}>
            <div style={partHead}>
              <span style={partNo}>Part {p.no}</span>
              <h2 style={partTitle}>{p.title}</h2>
              <span style={p.badge === "필수" ? badgeReq : badgeChk}>{p.badge}</span>
            </div>
            <p style={intro}>{p.intro}</p>

            {p.clauses && (
              <ul style={clauseList}>
                {p.clauses.map((c, i) => (
                  <li key={i} style={clauseItem}>
                    {c.label && <b style={clauseLabel}>({c.label})</b>} {c.text}
                  </li>
                ))}
              </ul>
            )}

            {p.rows && (
              <dl style={rowTable}>
                {p.rows.map((r, i) => (
                  <div key={i} style={isMobile ? rowLineMobile : rowLine}>
                    <dt style={rowKey}>{r.label}</dt>
                    <dd style={rowVal}>{r.text}</dd>
                  </div>
                ))}
              </dl>
            )}

            <label style={checks[p.key] ? consentRowOn : consentRow}>
              <input
                type="checkbox"
                checked={checks[p.key]}
                onChange={(e) => setChecks((s) => ({ ...s, [p.key]: e.target.checked }))}
                style={cb}
              />
              <span>{p.consent}</span>
            </label>
          </section>
        ))}

        <div style={signWrap}>
          <h3 style={signTitle}>서명</h3>
          <p style={signHint}>성명을 입력하고 아래 칸에 직접 서명해 주세요. (타이핑 + 드로잉 듀얼 서명)</p>
          <SignaturePad onChange={setSig} />
        </div>

        {error && <p style={errorText}>{error}</p>}

        <button onClick={onSubmit} disabled={!canSubmit || busy} style={canSubmit ? submitOn : submitOff}>
          {busy ? "제출 중…" : "동의하고 서명 제출"}
        </button>
        {!allChecked && <p style={footHint}>필수 동의 항목에 모두 체크해야 제출할 수 있습니다.</p>}
      </div>
    </main>
  );
}

const page: React.CSSProperties = { minHeight: "100vh", background: c.bg, padding: "44px 16px", color: c.ink };
const pageMobile: React.CSSProperties = { minHeight: "100dvh", background: c.bg, padding: "20px 12px", color: c.ink };
const card: React.CSSProperties = { maxWidth: 740, margin: "0 auto", background: c.surface, border: `1px solid ${c.line}`, borderRadius: radius.card, padding: "40px 44px", boxShadow: shadow.card };
const cardMobile: React.CSSProperties = { maxWidth: 740, margin: "0 auto", background: c.surface, border: `1px solid ${c.line}`, borderRadius: radius.card, padding: "24px 18px", boxShadow: shadow.card };
const brand: React.CSSProperties = { fontSize: 12, letterSpacing: 1, color: c.brand, fontWeight: 700 };
const docTitle: React.CSSProperties = { fontSize: 23, fontWeight: 700, margin: "8px 0 14px", lineHeight: 1.4, letterSpacing: "-0.3px" };
const lead: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.8, color: c.sub, margin: 0 };
const allRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 11, margin: "24px 0 8px", padding: "15px 18px", border: `1.5px solid ${c.brand}`, borderRadius: radius.control, background: c.brandTint, fontSize: 15, fontWeight: 700, cursor: "pointer" };
const allHint: React.CSSProperties = { fontWeight: 400, fontSize: 12.5, color: c.sub };
const cbAll: React.CSSProperties = { width: 18, height: 18, accentColor: c.brand };
const partBox: React.CSSProperties = { marginTop: 16, padding: "20px 22px", border: `1px solid ${c.line}`, borderRadius: radius.card, background: c.panel };
const partHead: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, marginBottom: 11 };
const partNo: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: c.brandText, background: c.brandTintStrong, borderRadius: radius.pill, padding: "3px 10px" };
const partTitle: React.CSSProperties = { fontSize: 15.5, fontWeight: 700, margin: 0, flex: 1, letterSpacing: "-0.2px" };
const badgeReq: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#9a3412", background: "#fef0e6", border: "1px solid #f5c89f", borderRadius: radius.pill, padding: "2px 10px" };
const badgeChk: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: c.brandText, background: c.brandTint, border: `1px solid ${c.brandBorder}`, borderRadius: radius.pill, padding: "2px 10px" };
const intro: React.CSSProperties = { fontSize: 13, lineHeight: 1.75, color: "#3f4a41", margin: "0 0 10px" };
const clauseList: React.CSSProperties = { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 9 };
const clauseItem: React.CSSProperties = { fontSize: 12.5, lineHeight: 1.75, color: c.sub, paddingLeft: 13, borderLeft: `2px solid ${c.brandBorder}` };
const clauseLabel: React.CSSProperties = { color: c.ink };
const rowTable: React.CSSProperties = { margin: 0, display: "grid", gap: 1, background: c.line, border: `1px solid ${c.line}`, borderRadius: radius.control, overflow: "hidden" };
const rowLine: React.CSSProperties = { display: "grid", gridTemplateColumns: "140px 1fr", gap: 1 };
const rowLineMobile: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr", gap: 1 };
const rowKey: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: c.ink, background: "#f2f4ef", padding: "11px 13px" };
const rowVal: React.CSSProperties = { fontSize: 12.5, lineHeight: 1.7, color: c.sub, background: "#fff", padding: "11px 13px" };
const consentRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginTop: 13, padding: "12px 14px", border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", fontSize: 13.5, fontWeight: 600, color: c.ink, cursor: "pointer" };
const consentRowOn: React.CSSProperties = { ...consentRow, border: `1px solid ${c.brand}`, background: c.brandTint, color: c.brandText };
const cb: React.CSSProperties = { width: 17, height: 17, accentColor: c.brand };
const signWrap: React.CSSProperties = { marginTop: 28, paddingTop: 24, borderTop: `1px solid ${c.line}` };
const signTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, margin: "0 0 4px" };
const signHint: React.CSSProperties = { fontSize: 12.5, color: c.sub, margin: "0 0 12px" };
const errorText: React.CSSProperties = { color: c.danger, fontSize: 13, marginTop: 12 };
const submitOn: React.CSSProperties = { width: "100%", marginTop: 20, padding: "13px 14px", borderRadius: radius.control, border: "1px solid transparent", background: c.brand, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" };
const submitOff: React.CSSProperties = { ...submitOn, border: `1px solid ${c.line2}`, background: "#f1f2ee", color: c.faint, cursor: "not-allowed" };
const footHint: React.CSSProperties = { fontSize: 12, color: c.faint, textAlign: "center", margin: "10px 0 0" };
