"use client";

import { ChevronLeft, ChevronRight, Radio, ScrollText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getAuditLogs, type AuditLogItem, type AuditLogList } from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { c, radius } from "@/lib/theme";
import { S, useAdminGuard, useAudit } from "../ui";

const LABEL: Record<string, string> = {
  LOGIN: "로그인",
  AGREE_SIGN: "동의·서약 서명",
  AUTOSAVE: "임시저장",
  SUBMIT: "제출",
  REJECT: "폐기",
  RESTORE: "폐기 복원",
  BATCH_SUBMIT: "최종 제출",
  BATCH_UNLOCK: "잠금 해제",
  PAYMENT_INFO: "계좌 등록",
  DATASET_UPLOAD: "데이터셋 업로드",
  RESERVED_UPLOAD: "예비 보충",
  BATCH_DELETE: "배치 삭제",
  TASK_RESET: "작업 리셋",
  PII_PURGE: "PII 파기",
};

// 필터 칩 — 자주 보는 유형 위주(전체 목록은 LABEL 기준)
const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "전체" },
  { key: "SUBMIT", label: "제출" },
  { key: "REJECT", label: "폐기" },
  { key: "BATCH_SUBMIT", label: "최종 제출" },
  { key: "LOGIN", label: "로그인" },
  { key: "AGREE_SIGN", label: "서약 서명" },
  { key: "PAYMENT_INFO", label: "계좌 등록" },
  { key: "AUTOSAVE", label: "임시저장" },
];

const PAGE_SIZE = 30;

// details에서 사람이 읽을 요약 추출
function summarize(it: AuditLogItem): string {
  const d = it.details ?? {};
  const parts: string[] = [];
  if (typeof d.task_id === "string") parts.push(`문항 ${d.task_id.slice(0, 8)}`);
  if (typeof d.reason === "string") parts.push(`사유: ${d.reason}`);
  if (typeof d.batch_id === "string") parts.push(`batch ${d.batch_id}`);
  if (typeof d.reviewer_code === "string") parts.push(String(d.reviewer_code));
  if (typeof d.completed === "number") parts.push(`완료 ${d.completed}건`);
  if (typeof d.reset === "number") parts.push(`초기화 ${d.reset}건`);
  if (typeof d.added === "number") parts.push(`추가 ${d.added}건`);
  if (typeof d.datasets === "number") parts.push(`문항 ${d.datasets}건`);
  const ae = d.active_edit as { change_ratio?: number } | undefined;
  if (ae?.change_ratio != null) parts.push(`변경률 ${Math.round(ae.change_ratio * 100)}%`);
  return parts.join(" · ");
}

export default function EventsPage() {
  const ready = useAdminGuard();
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditLogList | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await getAuditLogs({ actionType: filter || undefined, page, pageSize: PAGE_SIZE }));
    } catch {
      setError("감사 로그를 불러오지 못했습니다.");
    }
  }, [filter, page]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  // 실시간 이벤트 수신 시 1페이지면 자동 갱신
  const { connected } = useAudit(() => {
    if (page === 1) load();
  });

  if (!ready) return <main style={S.loading}>확인 중…</main>;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <Shell
      role="admin"
      title="실시간 이벤트 · 감사 로그"
      right={<span style={connected ? S.liveOn : S.liveOff}><Radio size={14} /> {connected ? "실시간 연결됨" : "실시간 대기"}</span>}
    >
      <p style={S.pageLead}>
        <ScrollText size={14} style={{ verticalAlign: -2, marginRight: 5 }} />
        모든 행위(로그인·서약·저장·제출·폐기·관리자 작업)가 감사 로그로 기록됩니다. 실시간 연결 중엔 새 활동이 자동으로 반영됩니다.
      </p>

      <div style={chips}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }} style={f.key === filter ? chipOn : chip}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      <div style={feed}>
        <div style={feedHead}>
          <span>시각</span>
          <span>유형</span>
          <span>행위자</span>
          <span>내용</span>
          <span>IP</span>
        </div>
        {(data?.items ?? []).length === 0 && <div style={S.empty}>기록된 로그가 없습니다.</div>}
        {(data?.items ?? []).map((it) => (
          <div key={it.id} style={row} className="adm-event-row">
            <span style={{ color: c.sub, fontVariantNumeric: "tabular-nums" }}>
              {new Date(it.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}
            </span>
            <span style={typePill(it.action_type)}>{LABEL[it.action_type] ?? it.action_type}</span>
            <span style={{ fontWeight: 600 }}>
              {it.role === "admin" ? `관리자(${it.username})` : it.reviewer_code ?? it.username ?? "-"}
            </span>
            <span style={detailCell} title={it.details ? JSON.stringify(it.details) : undefined}>{summarize(it) || "-"}</span>
            <span style={{ color: c.faint, fontSize: 12, fontFamily: "monospace" }}>{it.client_ip ?? "-"}</span>
          </div>
        ))}
      </div>

      {data && data.total > PAGE_SIZE && (
        <div style={pager}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={page <= 1 ? pagerBtnOff : pagerBtn}><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 12.5, color: c.sub }}>{page} / {totalPages} · 총 {data.total.toLocaleString()}건</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={page >= totalPages ? pagerBtnOff : pagerBtn}><ChevronRight size={15} /></button>
        </div>
      )}
    </Shell>
  );
}

const ADMIN_ACTIONS = new Set(["DATASET_UPLOAD", "RESERVED_UPLOAD", "BATCH_DELETE", "BATCH_UNLOCK", "TASK_RESET", "RESTORE", "PII_PURGE"]);

const chips: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 };
const chip: React.CSSProperties = { fontSize: 12.5, fontWeight: 500, color: c.sub, background: "#fff", border: `1px solid ${c.line2}`, borderRadius: 999, padding: "5px 13px", cursor: "pointer" };
const chipOn: React.CSSProperties = { ...chip, color: c.brandText, background: c.brandTint, borderColor: c.brandBorder, fontWeight: 600 };
const feed: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: "8px 20px 12px" };
const grid = "150px 110px 130px minmax(0,1fr) 120px";
const feedHead: React.CSSProperties = { display: "grid", gridTemplateColumns: grid, gap: 10, padding: "12px 0 10px", fontSize: 12, fontWeight: 600, color: c.sub, borderBottom: `1px solid ${c.line}` };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: grid, gap: 10, fontSize: 13, borderTop: `1px solid ${c.line}`, padding: "10px 0", alignItems: "center" };
const typePill = (action: string): React.CSSProperties => ({
  justifySelf: "start",
  fontSize: 12,
  fontWeight: 600,
  color: ADMIN_ACTIONS.has(action) ? c.warnText : c.brandText,
  background: ADMIN_ACTIONS.has(action) ? c.warnBg : c.brandTint,
  border: `1px solid ${ADMIN_ACTIONS.has(action) ? c.warnBorder : c.brandBorder}`,
  borderRadius: 999,
  padding: "2px 10px",
  whiteSpace: "nowrap",
});
const detailCell: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: c.sub };
const pager: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "14px 0 2px" };
const pagerBtn: React.CSSProperties = { display: "flex", alignItems: "center", border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", padding: "4px 8px", cursor: "pointer", color: c.ink };
const pagerBtnOff: React.CSSProperties = { ...pagerBtn, color: c.faint, cursor: "default", opacity: 0.5 };
