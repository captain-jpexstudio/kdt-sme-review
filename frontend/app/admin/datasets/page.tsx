"use client";

import { CheckCircle2, Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { deleteBatch, getBatches, uploadDataset, type BatchInfo, type DatasetUploadResult } from "@/lib/admin";
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
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refreshBatches = useCallback(async () => {
    try {
      setBatches(await getBatches());
    } catch {
      /* 목록 실패는 업로드를 막지 않음 */
    }
  }, []);

  useEffect(() => {
    if (ready) refreshBatches();
  }, [ready, refreshBatches]);

  const submit = async () => {
    if (!file || busy) return;
    // 이중 업로드 안전장치 — 기존 배치가 있으면 작업량 증가를 명시적으로 확인
    if (batches.length > 0) {
      const ok = window.confirm(
        `이미 배치 ${batches.length}개(${batches.map((b) => b.batch_id).join(", ")})가 운영 중입니다.\n\n` +
          "업로드하면 별도의 새 배치가 추가되고, 검수자마다 배정 문항이 그만큼 늘어나며 " +
          "최종 제출도 새 배치까지 완료해야 가능해집니다.\n\n계속할까요?",
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await uploadDataset(file, { batchId: batchId.trim() || undefined, perReviewer });
      setResult(r);
      await refreshBatches();
    } catch (e) {
      const d = (e as { response?: { data?: { message?: string; detail?: { message?: string } } } })?.response?.data;
      setError(d?.message ?? d?.detail?.message ?? "업로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const removeBatch = async (b: BatchInfo) => {
    if (!b.batch_id) return;
    const ok = window.confirm(
      `배치 "${b.batch_id}"를 삭제합니다.\n문항 ${b.main + b.reserved}건과 배정 태스크 ${b.tasks}건이 모두 제거됩니다.\n\n(검수가 시작된 배치는 서버에서 거부됩니다) 계속할까요?`,
    );
    if (!ok) return;
    setDeleting(b.batch_id);
    setError(null);
    try {
      const r = await deleteBatch(b.batch_id);
      window.alert(`배치 삭제 완료 · 문항 ${r.datasets}건, 태스크 ${r.tasks}건 제거`);
      await refreshBatches();
    } catch (e) {
      const d = (e as { response?: { data?: { detail?: { message?: string } } } })?.response?.data;
      window.alert(d?.detail?.message ?? "삭제에 실패했습니다.");
    } finally {
      setDeleting(null);
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

      <div style={{ ...S.panel, marginTop: 16 }}>
        <h2 style={S.panelTitle}>업로드된 배치</h2>
        <p style={S.pageLead}>업로드는 배치 단위로 추가됩니다. 검수가 시작되지 않은(미착수) 배치만 삭제할 수 있습니다 — 이중 업로드 사고 복구용.</p>
        {batches.length === 0 && <div style={S.empty}>업로드된 배치가 없습니다.</div>}
        {batches.length > 0 && (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>batch_id</th>
                <th style={th}>본검수(main)</th>
                <th style={th}>예비(reserved)</th>
                <th style={th}>배정 태스크</th>
                <th style={th}>상태</th>
                <th style={thR}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.batch_id ?? "none"}>
                  <td style={tdMono}>{b.batch_id ?? "(없음)"}</td>
                  <td style={td}>{b.main}</td>
                  <td style={td}>{b.reserved}</td>
                  <td style={td}>{b.tasks}</td>
                  <td style={td}>
                    {b.started
                      ? <span style={{ color: c.brandText, fontWeight: 600 }}>검수 진행 중</span>
                      : <span style={{ color: c.sub }}>미착수</span>}
                  </td>
                  <td style={tdR}>
                    <button
                      onClick={() => removeBatch(b)}
                      disabled={b.started || deleting === b.batch_id}
                      title={b.started ? "검수가 시작된 배치는 삭제할 수 없습니다" : "배치 삭제"}
                      style={b.started ? S.disabledButton : dangerBtn}
                    >
                      {deleting === b.batch_id ? <Loader2 size={13} /> : <Trash2 size={13} />} 삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${c.line}`, color: c.sub, fontWeight: 600, whiteSpace: "nowrap" };
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "11px 12px", borderBottom: `1px solid ${c.line}`, color: c.ink };
const tdMono: React.CSSProperties = { ...td, fontFamily: "monospace" };
const tdR: React.CSSProperties = { ...td, textAlign: "right" };
const dangerBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${c.dangerBorder}`, background: "#fff", color: c.danger, borderRadius: radius.control, padding: "5px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
