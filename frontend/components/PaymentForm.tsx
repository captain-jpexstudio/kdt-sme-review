"use client";
import { useState } from "react";

import { savePayment } from "@/lib/tasks";
import { c, radius, shadow } from "@/lib/theme";

// 최종 제출 후 자문료 지급 계좌 입력(수정사항 #3). 확인(alert) 후 저장.
export function PaymentForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim() && bank.trim() && account.trim();

  const submit = async () => {
    if (!valid || busy) return;
    const ok = window.confirm(
      `아래 정보로 자문료 지급 계좌를 등록합니다.\n\n예금주: ${name.trim()}\n은행: ${bank.trim()}\n계좌번호: ${account.trim()}\n\n입력하신 정보가 정확한가요?`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await savePayment({ account_holder: name.trim(), bank_name: bank.trim(), bank_account: account.trim(), phone: phone.trim() || undefined });
      window.alert("계좌 정보가 등록되었습니다. 검수에 참여해 주셔서 감사합니다.");
      onDone();
    } catch {
      setError("저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <span style={brand}>자문료 지급 안내</span>
        <h2 style={title}>계좌 정보 입력</h2>
        <p style={lead}>
          최종 제출이 완료되었습니다. 자문료(기타소득) 지급을 위해 아래 정보를 입력해 주세요. 입력 정보는 암호화되어
          안전하게 보관되며 정산 목적으로만 사용됩니다.
        </p>
        <div style={form}>
          <Field label="예금주 (성명)"><input value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="홍길동" disabled={busy} /></Field>
          <Field label="은행명"><input value={bank} onChange={(e) => setBank(e.target.value)} style={input} placeholder="○○은행" disabled={busy} /></Field>
          <Field label="계좌번호"><input value={account} onChange={(e) => setAccount(e.target.value)} style={input} placeholder="숫자만" disabled={busy} /></Field>
          <Field label="연락처 (선택)"><input value={phone} onChange={(e) => setPhone(e.target.value)} style={input} placeholder="010-0000-0000" disabled={busy} /></Field>
        </div>
        {error && <p style={errText}>{error}</p>}
        <button onClick={submit} disabled={!valid || busy} style={valid && !busy ? primary : primaryOff}>
          {busy ? "저장 중…" : "계좌 정보 저장"}
        </button>
        <button onClick={onDone} disabled={busy} style={later}>나중에 입력</button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={field}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,20,25,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 };
const modal: React.CSSProperties = { width: "100%", maxWidth: 460, background: c.surface, borderRadius: radius.card, boxShadow: shadow.pop, padding: "26px 30px", display: "flex", flexDirection: "column" };
const brand: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: 1, color: c.brand };
const title: React.CSSProperties = { fontSize: 20, fontWeight: 700, margin: "8px 0 10px", letterSpacing: "-0.3px", color: c.ink };
const lead: React.CSSProperties = { fontSize: 13, lineHeight: 1.75, color: c.sub, margin: "0 0 18px" };
const form: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 13 };
const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: c.ink };
const input: React.CSSProperties = { height: 40, border: `1px solid ${c.line2}`, borderRadius: radius.control, padding: "0 12px", fontSize: 14, background: "#fff", color: c.ink };
const errText: React.CSSProperties = { color: c.danger, fontSize: 13, margin: "12px 0 0" };
const primary: React.CSSProperties = { height: 44, marginTop: 20, borderRadius: radius.control, border: "1px solid transparent", background: c.brand, color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer" };
const primaryOff: React.CSSProperties = { ...primary, background: "#f1f2ee", color: c.faint, border: `1px solid ${c.line2}`, cursor: "not-allowed" };
const later: React.CSSProperties = { height: 36, marginTop: 8, borderRadius: radius.control, border: "none", background: "transparent", color: c.sub, fontSize: 13, fontWeight: 500, cursor: "pointer" };
