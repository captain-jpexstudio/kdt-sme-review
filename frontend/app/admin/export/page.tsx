"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { exportUrl, getAuditLogs, getBatches, type AuditLogItem, type BatchInfo } from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { c, radius } from "@/lib/theme";
import { S, useAdminGuard } from "../ui";

const COLUMNS = [
  ["reviewer_code", "검수자 가명 코드 (실명·PII 미포함)"],
  ["batch_id · dataset_id", "배치 · 문항 식별자"],
  ["capability_category · joint_domain · difficulty · question_type", "벤치마크 메타"],
  ["original_q · original_a", "원본 질문·정답"],
  ["modified_q · modified_a", "검수자 수정본"],
  ["rationale_cot", "해설"],
  ["error_reasons · error_note", "오류 태깅·메모"],
  ["submitted_at", "제출 시각"],
] as const;

export default function AdminExportPage() {
  const ready = useAdminGuard();
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [batchId, setBatchId] = useState("");
  const [lockedOnly, setLockedOnly] = useState(true);
  const [history, setHistory] = useState<AuditLogItem[]>([]);

  const refresh = useCallback(async () => {
    const [b, h] = await Promise.all([
      getBatches().catch(() => []),
      getAuditLogs({ actionType: "EXPORT", pageSize: 10 }).then((r) => r.items).catch(() => []),
    ]);
    setBatches(b);
    setHistory(h);
  }, []);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  if (!ready) return <main style={S.loading}>확인 중…</main>;

  return (
    <Shell role="admin" title="내보내기">
      <div style={S.panel}>
        <h2 style={S.panelTitle}>검수 결과 Export (xlsx)</h2>
        <p style={S.pageLead}>
          완료(제출)된 문항을 xlsx로 내려받습니다. 폐기 문항은 포함되지 않으며, 검수자는 가명 코드로만 표기됩니다.
        </p>

        <div style={form}>
          <label style={field}>
            <span style={label}>배치</span>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} style={select}>
              <option value="">전체 배치</option>
              {batches.map((b) => (
                <option key={b.batch_id ?? "none"} value={b.batch_id ?? ""}>
                  {b.batch_id} (본검수 {b.main}건)
                </option>
              ))}
            </select>
          </label>
          <label style={checkRow} title="최종 서명 제출(잠금)까지 마친 검수자의 문항만 내보냅니다">
            <input type="checkbox" checked={lockedOnly} onChange={(e) => setLockedOnly(e.target.checked)} />
            <span>
              <b>최종 제출자만</b> <span style={hint}>— 반출용 확정본. 해제하면 진행 중 검수자의 완료분도 포함(중간 점검용)</span>
            </span>
          </label>
          <div>
            <a href={exportUrl(batchId || undefined, lockedOnly)} style={S.primaryButton} onClick={() => setTimeout(refresh, 1500)}>
              <Download size={16} /> 다운로드{lockedOnly ? " (최종본)" : " (전체 완료분)"}
            </a>
          </div>
        </div>
      </div>

      <div style={{ ...S.panel, marginTop: 16 }}>
        <h2 style={S.panelTitle}><FileSpreadsheet size={15} style={{ verticalAlign: -2 }} /> 포함 컬럼</h2>
        <dl style={colList}>
          {COLUMNS.map(([k, v]) => (
            <div key={k} style={colRow}>
              <dt style={colKey}>{k}</dt>
              <dd style={colVal}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div style={{ ...S.panel, marginTop: 16 }}>
        <h2 style={S.panelTitle}>최근 내보내기 이력</h2>
        {history.length === 0 && <div style={S.empty}>아직 내보내기 이력이 없습니다.</div>}
        {history.map((h) => {
          const d = h.details ?? {};
          return (
            <div key={h.id} style={histRow}>
              <span style={{ color: c.sub, fontVariantNumeric: "tabular-nums" }}>
                {new Date(h.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
              <span>{typeof d.batch_id === "string" && d.batch_id ? `batch ${d.batch_id}` : "전체 배치"}</span>
              <span style={d.locked_only ? finalPill : draftPill}>{d.locked_only ? "최종본" : "전체 완료분"}</span>
              <span style={{ color: c.sub }}>{typeof d.rows === "number" ? `${d.rows}행` : "-"}</span>
              <span style={{ color: c.faint }}>{h.username ?? "-"}</span>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

const form: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 };
const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: c.ink };
const hint: React.CSSProperties = { fontSize: 12.5, fontWeight: 400, color: c.sub };
const select: React.CSSProperties = { height: 38, border: `1px solid ${c.line2}`, borderRadius: radius.control, padding: "0 10px", fontSize: 13.5, background: "#fff", color: c.ink };
const checkRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: c.ink, cursor: "pointer", lineHeight: 1.5 };
const colList: React.CSSProperties = { margin: 0, display: "flex", flexDirection: "column", gap: 0 };
const colRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(200px, 380px) 1fr", gap: 14, padding: "9px 0", borderTop: `1px solid ${c.line}`, fontSize: 13 };
const colKey: React.CSSProperties = { fontFamily: "monospace", color: c.ink, fontSize: 12.5 };
const colVal: React.CSSProperties = { margin: 0, color: c.sub };
const histRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "130px minmax(0,1fr) 110px 70px 90px", gap: 10, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${c.line}`, fontSize: 13 };
const finalPill: React.CSSProperties = { justifySelf: "start", fontSize: 11.5, fontWeight: 600, color: c.brandText, background: c.brandTint, border: `1px solid ${c.brandBorder}`, borderRadius: 999, padding: "1px 9px" };
const draftPill: React.CSSProperties = { ...finalPill, color: c.sub, background: c.soft, borderColor: c.line2 };
