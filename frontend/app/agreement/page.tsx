"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SignaturePad, type SignatureValue } from "@/components/SignaturePad";
import { postAgreement } from "@/lib/auth";

const CONSENTS = [
  { key: "security_copyright", label: "보안 서약 및 산출물 저작권 귀속에 동의합니다." },
  { key: "privacy", label: "개인정보 수집 및 이용에 동의합니다." },
  { key: "tax", label: "세무 신고를 위한 유선 연락·처리 방침을 확인하였습니다." },
] as const;

export default function AgreementPage() {
  const router = useRouter();
  const [checks, setChecks] = useState({ security_copyright: false, privacy: false, tax: false });
  const [sig, setSig] = useState<SignatureValue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allChecked = CONSENTS.every((c) => checks[c.key]);
  const canSubmit = allChecked && sig !== null;

  const onSubmit = async () => {
    if (!canSubmit || !sig) return;
    setBusy(true);
    setError(null);
    try {
      await postAgreement({ typed_name: sig.typedName, signature_png: sig.png, checkbox_states: checks });
      router.push("/workspace");
    } catch {
      setError("동의 제출에 실패했습니다. 서명과 체크 항목을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 520, margin: "48px auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20 }}>검수 참여 동의 · 보안 서약</h1>
      <p style={{ color: "#666", fontSize: 13 }}>아래 3개 항목에 모두 동의하고 듀얼 서명을 완료해야 검수를 시작할 수 있습니다.</p>

      <div style={{ display: "grid", gap: 10, margin: "16px 0" }}>
        {CONSENTS.map((c) => (
          <label key={c.key} style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "flex-start" }}>
            <input
              type="checkbox"
              checked={checks[c.key]}
              onChange={(e) => setChecks((s) => ({ ...s, [c.key]: e.target.checked }))}
            />
            <span>{c.label}</span>
          </label>
        ))}
      </div>

      <SignaturePad onChange={setSig} />

      {error && <p style={{ color: "#a32d2d", fontSize: 13, marginTop: 10 }}>{error}</p>}
      <button
        onClick={onSubmit}
        disabled={!canSubmit || busy}
        style={{
          marginTop: 16, padding: "10px 14px", borderRadius: 6, border: "1px solid #185fa5",
          background: canSubmit ? "#e6f1fb" : "#f1efe8", color: canSubmit ? "#185fa5" : "#999",
          cursor: canSubmit ? "pointer" : "not-allowed",
        }}
      >
        {busy ? "제출 중…" : "동의하고 서명 제출"}
      </button>
    </main>
  );
}
