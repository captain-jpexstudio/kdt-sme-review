"use client";

import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { useState } from "react";

import { uploadDataset, type DatasetUploadResult } from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { c, radius } from "@/lib/theme";
import { S, useAdminGuard } from "../ui";

export default function AdminDatasetsPage() {
  const ready = useAdminGuard();
  const [file, setFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState("");
  const [perReviewer, setPerReviewer] = useState(300);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DatasetUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await uploadDataset(file, { batchId: batchId.trim() || undefined, perReviewer });
      setResult(r);
    } catch (e) {
      const d = (e as { response?: { data?: { message?: string; detail?: { message?: string } } } })?.response?.data;
      setError(d?.message ?? d?.detail?.message ?? "업로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <main style={S.loading}>확인 중…</main>;

  return (
    <Shell role="admin" title="데이터셋 업로드">
      <div style={S.panel}>
        <h2 style={S.panelTitle}>QA 데이터셋 업로드 (xlsx)</h2>
        <p style={S.pageLead}>
          필수 컬럼 <b>question</b>·<b>answer</b> · 선택 <b>해설</b>(rationale)·<b>assigned_persona</b> (별칭 질문/정답/해설 자동 매핑).
          문항 수는 <b>검수자 수 × 배정 수</b>와 정확히 일치해야 합니다(예: 7 × 300 = 2,100).
        </p>

        <div style={form}>
          <label style={field}>
            <span style={label}>파일 (.xlsx)</span>
            <input type="file" accept=".xlsx,.xlsm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
          </label>
          <label style={field}>
            <span style={label}>batch_id <span style={hint}>· 비우면 자동 생성</span></span>
            <input value={batchId} onChange={(e) => setBatchId(e.target.value)} placeholder="예: kdefense-2100-0705" style={S.batchInput} disabled={busy} />
          </label>
          <label style={field}>
            <span style={label}>검수자당 배정 수</span>
            <input type="number" min={1} value={perReviewer} onChange={(e) => setPerReviewer(Number(e.target.value) || 0)} style={S.batchInput} disabled={busy} />
          </label>
          <div>
            <button onClick={submit} disabled={!file || busy} style={!file || busy ? S.disabledButton : S.primaryButton}>
              {busy ? <Loader2 size={16} /> : <Upload size={16} />} {busy ? "업로드 중…" : "업로드"}
            </button>
          </div>
        </div>

        {error && <div style={{ ...S.errorBox, marginTop: 16 }}>{error}</div>}
        {result && (
          <div style={okBox}>
            <CheckCircle2 size={18} color={c.brand} style={{ flexShrink: 0 }} />
            <div>
              업로드 완료 · batch <b>{result.batch_id}</b> · 문항 {result.datasets}건 · 태스크 {result.tasks}건 · 검수자 {result.reviewers}명 × {result.per_reviewer}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

const form: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16, maxWidth: 460 };
const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: c.ink };
const hint: React.CSSProperties = { fontSize: 12, fontWeight: 400, color: c.faint };
const okBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginTop: 16,
  border: `1px solid ${c.line}`,
  background: c.brandTint,
  color: c.ink,
  borderRadius: radius.control,
  padding: "12px 14px",
  fontSize: 13,
};
