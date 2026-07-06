"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, ListChecks, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  getAdminTasks,
  getTaskDiff,
  type AdminTaskDiff,
  type AdminTaskItem,
  type AdminTaskList,
} from "@/lib/admin";
import { c, radius, shadow } from "@/lib/theme";
import { S } from "../ui";

const PAGE_SIZE = 20;

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  in_progress: "작업중",
  completed: "완료",
  rejected: "폐기",
};

// ---- 단어 diff(LCS) — 원본 측 삭제·수정 측 추가 하이라이트 ----
type Piece = { text: string; changed: boolean };

function diffPieces(orig: string, mod: string): { left: Piece[]; right: Piece[] } {
  const a = orig.split(/\s+/).filter(Boolean);
  const b = mod.split(/\s+/).filter(Boolean);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const left: Piece[] = [];
  const right: Piece[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      left.push({ text: a[i], changed: false });
      right.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left.push({ text: a[i++], changed: true });
    } else {
      right.push({ text: b[j++], changed: true });
    }
  }
  while (i < n) left.push({ text: a[i++], changed: true });
  while (j < m) right.push({ text: b[j++], changed: true });
  return { left, right };
}

function DiffedText({ pieces, tone }: { pieces: Piece[]; tone: "del" | "add" }) {
  const mark: React.CSSProperties =
    tone === "del"
      ? { background: c.dangerBg, color: c.danger, textDecoration: "line-through", borderRadius: 3, padding: "0 2px" }
      : { background: c.brandTint, color: c.brandText, fontWeight: 600, borderRadius: 3, padding: "0 2px" };
  return (
    <p style={diffP}>
      {pieces.map((p, idx) => (
        <span key={idx} style={p.changed ? mark : undefined}>{p.text} </span>
      ))}
    </p>
  );
}

// ---- 필터 정의 ----
type QuickFilter = "all" | "suspicious" | "tagged" | "completed" | "in_progress" | "pending" | "rejected";

const FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "completed", label: "완료" },
  { key: "in_progress", label: "작업중" },
  { key: "pending", label: "대기" },
  { key: "rejected", label: "폐기" },
  { key: "suspicious", label: "의심(변경량 낮음)" },
  { key: "tagged", label: "오류 태깅" },
];

export function TasksPanel({ userId }: { userId: string }) {
  const [filter, setFilter] = useState<QuickFilter>("all");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminTaskList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diff, setDiff] = useState<AdminTaskDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(
        await getAdminTasks({
          userId,
          status: ["completed", "in_progress", "pending", "rejected"].includes(filter) ? filter : undefined,
          suspicious: filter === "suspicious" ? true : undefined,
          tagged: filter === "tagged" ? true : undefined,
          q: q || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
      );
    } catch {
      setError("문항 목록을 불러오지 못했습니다.");
    }
  }, [userId, filter, q, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setFilter("all");
    setQ("");
    setQInput("");
  }, [userId]);

  const openDiff = async (t: AdminTaskItem) => {
    setDiffLoading(true);
    try {
      setDiff(await getTaskDiff(t.task_id));
    } catch {
      setError("대조 정보를 불러오지 못했습니다.");
    } finally {
      setDiffLoading(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const histMax = data ? Math.max(1, ...data.ratio_histogram) : 1;

  return (
    <div style={wrap}>
      <div style={head}>
        <div style={title}><ListChecks size={15} /> 문항 목록</div>
        <div style={searchBox}>
          <Search size={13} style={{ color: c.faint }} />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setQ(qInput.trim()); setPage(1); } }}
            placeholder="문항 검색 (Enter)"
            style={searchInput}
          />
        </div>
      </div>

      {/* 변경률 분포(완료분) + 의심 요약 — spec §10 품질 지표 */}
      {data && (
        <div style={histRow}>
          <div style={histBars} title="완료 문항 정답 변경률 분포">
            {data.ratio_histogram.map((n, i) => (
              <div key={i} style={histCol}>
                <div style={{ ...histBar, height: `${(n / histMax) * 100}%`, background: i < 1 ? c.warn : c.brand, opacity: n ? 1 : 0.15 }} />
                <span style={histLabel}>{i === 9 ? "90+" : `${i * 10}`}</span>
              </div>
            ))}
          </div>
          <div style={histMeta}>
            <span>변경률 분포(완료분, %)</span>
            <span style={{ color: data.suspicious_total ? c.warnText : c.sub }}>
              <AlertTriangle size={12} style={{ verticalAlign: -2 }} /> 의심 {data.suspicious_total}건
            </span>
          </div>
        </div>
      )}

      <div style={chips}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }} style={f.key === filter ? chipOn : chip}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <div style={S.errorBox}>{error}</div>}

      <div style={tableHead}>
        <span>문항</span>
        <span>미리보기</span>
        <span>상태</span>
        <span>변경률</span>
        <span>제출</span>
      </div>
      {(data?.items ?? []).length === 0 && <div style={S.empty}>조건에 맞는 문항이 없습니다.</div>}
      {(data?.items ?? []).map((t) => (
        <button key={t.task_id} onClick={() => openDiff(t)} style={rowBtn} className="adm-task-row">
          <span style={{ fontFamily: "monospace", fontSize: 12, color: c.sub }}>{t.source_id ?? `#${t.dataset_id}`}</span>
          <span style={previewCell}>
            {t.q_preview}
            {t.suspicious && <em style={suspBadge}>의심</em>}
            {t.tagged && <em style={tagBadge}>태깅</em>}
            {t.q_changed && <em style={qBadge}>Q수정</em>}
          </span>
          <span style={statusCell(t.status)}>{STATUS_LABEL[t.status] ?? t.status}</span>
          <span style={{ fontVariantNumeric: "tabular-nums", color: t.change_ratio == null ? c.faint : c.ink }}>
            {t.change_ratio == null ? "-" : `${Math.round(t.change_ratio * 100)}%`}
          </span>
          <span style={{ fontSize: 12, color: c.sub }}>
            {t.submitted_at ? new Date(t.submitted_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-"}
          </span>
        </button>
      ))}

      {data && data.total > PAGE_SIZE && (
        <div style={pager}>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={page <= 1 ? pagerBtnOff : pagerBtn}><ChevronLeft size={15} /></button>
          <span style={{ fontSize: 12.5, color: c.sub }}>{page} / {totalPages} · 총 {data.total}건</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={page >= totalPages ? pagerBtnOff : pagerBtn}><ChevronRight size={15} /></button>
        </div>
      )}

      {(diff || diffLoading) && (
        <div style={overlay} onClick={() => setDiff(null)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            {diffLoading && <div style={S.loading}>불러오는 중…</div>}
            {diff && <DiffModal diff={diff} onClose={() => setDiff(null)} />}
          </div>
        </div>
      )}
    </div>
  );
}

function DiffModal({ diff, onClose }: { diff: AdminTaskDiff; onClose: () => void }) {
  return (
    <>
      <div style={modalHead}>
        <div>
          <div style={{ fontSize: 12, color: c.sub, marginBottom: 3 }}>
            {diff.reviewer_code ?? "-"} · {diff.source_id ?? diff.task_id.slice(0, 8)} · {STATUS_LABEL[diff.status] ?? diff.status}
            {diff.question_type ? ` · ${diff.question_type}` : ""}
          </div>
          <b style={{ fontSize: 16 }}>원본 ↔ 수정 대조</b>
          {diff.suspicious && <em style={{ ...suspBadge, marginLeft: 8 }}>의심(변경량 낮음)</em>}
        </div>
        <button onClick={onClose} style={closeBtn}><X size={17} /></button>
      </div>

      <DiffSection label="질문" side={diff.question} />
      <DiffSection label="정답" side={diff.answer} />

      {diff.choices && diff.choices.length > 0 && (
        <div style={metaBlock}>
          <b style={metaTitle}>선지</b>
          <ol style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: 13, color: c.ink }}>
            {diff.choices.map((ch, i) => <li key={i}>{String(ch)}</li>)}
          </ol>
        </div>
      )}
      {(diff.error_reasons?.length || diff.error_note) && (
        <div style={{ ...metaBlock, background: c.warnBg, borderColor: c.warnBorder }}>
          <b style={{ ...metaTitle, color: c.warnText }}>오류 태깅</b>
          {(diff.error_reasons ?? []).map((r, i) => (
            <span key={i} style={reasonChip}>{[r.target, r.reason].filter(Boolean).join(" · ")}</span>
          ))}
          {diff.error_note && <p style={{ margin: "6px 0 0", fontSize: 13, color: c.warnText }}>{diff.error_note}</p>}
        </div>
      )}
      {diff.rationale && (
        <div style={metaBlock}>
          <b style={metaTitle}>해설(원본)</b>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: c.sub, whiteSpace: "pre-wrap" }}>{diff.rationale}</p>
        </div>
      )}
    </>
  );
}

function DiffSection({ label, side }: { label: string; side: AdminTaskDiff["question"] }) {
  const has = side.modified != null && !side.identical;
  const pieces = has ? diffPieces(side.original, side.modified as string) : null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={diffSectionHead}>
        <b>{label}</b>
        {side.modified == null && <span style={{ color: c.faint, fontWeight: 400 }}>수정본 없음</span>}
        {side.modified != null && side.identical && <span style={{ color: c.faint, fontWeight: 400 }}>변경 없음</span>}
        {has && <span style={{ color: c.sub, fontWeight: 400 }}>변경 {side.changed_words}단어 · {Math.round(side.change_ratio * 100)}%</span>}
      </div>
      <div style={diffCols}>
        <div style={diffPane}>
          <span style={paneLabel}>원본</span>
          {pieces ? <DiffedText pieces={pieces.left} tone="del" /> : <p style={diffP}>{side.original}</p>}
        </div>
        <div style={{ ...diffPane, background: has ? "#fff" : c.soft }}>
          <span style={paneLabel}>수정</span>
          {pieces ? <DiffedText pieces={pieces.right} tone="add" /> : <p style={{ ...diffP, color: c.faint }}>{side.modified ?? "—"}</p>}
        </div>
      </div>
    </div>
  );
}

// ---- styles ----
const wrap: React.CSSProperties = { marginTop: 18, paddingTop: 16, borderTop: `1px solid ${c.line}` };
const head: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 };
const title: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700, color: c.ink };
const searchBox: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, border: `1px solid ${c.line2}`, borderRadius: radius.control, padding: "5px 9px", background: "#fff" };
const searchInput: React.CSSProperties = { border: "none", outline: "none", fontSize: 12.5, width: 160, background: "transparent", color: c.ink };
const histRow: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.control, background: c.soft, padding: "10px 12px 6px", marginBottom: 10 };
const histBars: React.CSSProperties = { display: "flex", alignItems: "flex-end", gap: 4, height: 44 };
const histCol: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%", justifyContent: "flex-end" };
const histBar: React.CSSProperties = { width: "100%", borderRadius: "3px 3px 0 0", minHeight: 2 };
const histLabel: React.CSSProperties = { fontSize: 9.5, color: c.faint };
const histMeta: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 11.5, color: c.sub, marginTop: 5 };
const chips: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 };
const chip: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: c.sub, background: "#fff", border: `1px solid ${c.line2}`, borderRadius: 999, padding: "4px 11px", cursor: "pointer" };
const chipOn: React.CSSProperties = { ...chip, color: c.brandText, background: c.brandTint, borderColor: c.brandBorder, fontWeight: 600 };
const gridCols = "90px minmax(0,1fr) 64px 62px 96px";
const tableHead: React.CSSProperties = { display: "grid", gridTemplateColumns: gridCols, gap: 10, fontSize: 12, fontWeight: 600, color: c.sub, padding: "8px 10px", borderBottom: `1px solid ${c.line}` };
const rowBtn: React.CSSProperties = { display: "grid", gridTemplateColumns: gridCols, gap: 10, alignItems: "center", textAlign: "left", width: "100%", fontSize: 13, color: c.ink, background: "transparent", border: "none", borderBottom: `1px solid ${c.line}`, padding: "9px 10px", cursor: "pointer" };
const previewCell: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const badgeBase: React.CSSProperties = { fontStyle: "normal", fontSize: 10.5, fontWeight: 600, borderRadius: 999, padding: "1px 7px", marginLeft: 6, verticalAlign: 1 };
const suspBadge: React.CSSProperties = { ...badgeBase, color: c.warnText, background: c.warnBg, border: `1px solid ${c.warnBorder}` };
const tagBadge: React.CSSProperties = { ...badgeBase, color: c.danger, background: c.dangerBg, border: `1px solid ${c.dangerBorder}` };
const qBadge: React.CSSProperties = { ...badgeBase, color: c.info, background: "#eef3fc", border: "1px solid #d4e0f5" };
const statusCell = (s: string): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 600,
  color: s === "completed" ? c.brandText : s === "rejected" ? c.danger : s === "in_progress" ? c.info : c.faint,
});
const pager: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "12px 0 2px" };
const pagerBtn: React.CSSProperties = { display: "flex", alignItems: "center", border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", padding: "4px 8px", cursor: "pointer", color: c.ink };
const pagerBtnOff: React.CSSProperties = { ...pagerBtn, color: c.faint, cursor: "default", opacity: 0.5 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,20,25,.42)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 24 };
const modal: React.CSSProperties = { width: "min(980px, 100%)", maxHeight: "86vh", overflowY: "auto", background: "#fff", borderRadius: radius.card, boxShadow: shadow.pop, padding: "20px 24px 24px" };
const modalHead: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 };
const closeBtn: React.CSSProperties = { border: "none", background: "transparent", cursor: "pointer", color: c.sub, padding: 4 };
const diffSectionHead: React.CSSProperties = { display: "flex", alignItems: "baseline", gap: 10, fontSize: 13.5, marginBottom: 7, color: c.ink };
const diffCols: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const diffPane: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.control, padding: "10px 12px", background: "#fff", minWidth: 0 };
const paneLabel: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: c.faint, marginBottom: 5 };
const diffP: React.CSSProperties = { margin: 0, fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" };
const metaBlock: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.control, background: c.soft, padding: "10px 13px", marginBottom: 10 };
const metaTitle: React.CSSProperties = { fontSize: 12.5, color: c.ink };
const reasonChip: React.CSSProperties = { display: "inline-block", fontSize: 12, fontWeight: 600, color: c.warnText, background: "#fff", border: `1px solid ${c.warnBorder}`, borderRadius: 999, padding: "2px 10px", margin: "6px 6px 0 0" };
