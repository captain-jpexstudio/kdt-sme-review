"use client";

import { diff_match_patch, DIFF_DELETE, DIFF_INSERT } from "diff-match-patch";
import { ChevronRight, Edit3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getMe } from "@/lib/auth";
import { getTask, listTasks, type TaskDetail, type TaskListItem } from "@/lib/tasks";
import { Shell } from "@/components/Shell";
import { c, radius, shadow } from "@/lib/theme";

export default function HistoryPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<TaskListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getMe()
      .then(async (me) => {
        if (!me.is_agreed) {
          router.replace("/agreement");
          return;
        }
        setReady(true);
        const list = await listTasks({ status: "completed", sort: "recent" });
        setItems(list);
        if (list[0]) setSelected(list[0].task_id);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    setBusy(true);
    getTask(selected)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setBusy(false));
  }, [selected]);

  if (!ready) return <main style={{ padding: 40, color: c.sub }}>확인 중…</main>;

  const curItem = items.find((i) => i.task_id === selected) ?? null;

  return (
    <Shell role="reviewer" title="내 검수 이력">
      <p style={lead}>제출 완료한 검수 내역입니다. 항목을 선택하면 원본 대비 무엇을 어떻게 수정했는지 확인할 수 있습니다. (읽기 전용)</p>

      {items.length === 0 ? (
        <div style={emptyBox}>아직 제출 완료한 검수가 없습니다. 워크스페이스에서 검수를 제출하면 여기에 쌓입니다.</div>
      ) : (
        <div style={master} className="adm-master">
          <div style={listCol}>
            {items.map((it) => (
              <button key={it.task_id} onClick={() => setSelected(it.task_id)} style={it.task_id === selected ? rowOn : row}>
                <span style={seq}>#{String(it.seq).padStart(3, "0")}</span>
                <span style={preview}>{it.q_preview}</span>
                {it.edited && <Edit3 size={13} color={c.faint} />}
                <ChevronRight size={15} color={c.faint} />
              </button>
            ))}
          </div>

          <div style={detailCol}>
            {busy && <div style={{ color: c.sub, fontSize: 13 }}>불러오는 중…</div>}
            {!busy && detail && curItem && <Detail d={detail} seq={curItem.seq} />}
            {!busy && !detail && <div style={{ color: c.sub, fontSize: 13 }}>항목을 선택하세요.</div>}
          </div>
        </div>
      )}
    </Shell>
  );
}

function Detail({ d, seq }: { d: TaskDetail; seq: number }) {
  const modQ = d.modified_q ?? d.original_q;
  const modA = d.modified_a ?? d.original_a;
  const qChanged = modQ.trim() !== d.original_q.trim();
  return (
    <>
      <div style={dEyebrow}>
        #{String(seq).padStart(3, "0")} · 완료{d.submitted_at ? ` · 제출 ${new Date(d.submitted_at).toLocaleString("ko-KR")}` : ""}
      </div>

      {qChanged && (
        <section style={card}>
          <div style={cardTitle}>질문 수정</div>
          <div style={cmpLabel}>원본 → 수정</div>
          <InlineDiff original={d.original_q} edited={modQ} />
        </section>
      )}

      <section style={cardHero}>
        <div style={cardTitle}>정답 검수 결과</div>
        <div style={two}>
          <div style={col}>
            <div style={cmpLabel}>원본 정답</div>
            <div style={ro}>{d.original_a}</div>
          </div>
          <div style={col}>
            <div style={cmpLabel}>제출한 수정 정답</div>
            <div style={ro}>{modA}</div>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={cmpLabel}>
            변경 내역 <span style={legend}><span style={ins}>추가</span><span style={del}>삭제</span></span>
          </div>
          <InlineDiff original={d.original_a} edited={modA} />
        </div>
      </section>

      <section style={card}>
        <div style={cardTitle}>오류 유형 · 메모</div>
        {(d.error_reasons ?? []).length === 0 ? (
          <div style={{ color: c.sub, fontSize: 13 }}>표시된 오류 유형이 없습니다.</div>
        ) : (
          <div style={tags}>
            {(d.error_reasons ?? []).map((r, i) => (
              <span key={i} style={tag}>{r.reason}{r.target && r.target !== "both" ? ` (${r.target === "question" ? "질문" : "정답"})` : ""}</span>
            ))}
          </div>
        )}
        {d.error_note && <div style={note}>{d.error_note}</div>}
      </section>
    </>
  );
}

const _dmp = new diff_match_patch();
function InlineDiff({ original, edited }: { original: string; edited: string }) {
  const parts = useMemo(() => {
    const dd = _dmp.diff_main(original || "", edited || "");
    _dmp.diff_cleanupSemantic(dd);
    return dd;
  }, [original, edited]);
  const changed = parts.some(([op]) => op !== 0);
  if (!changed) return <div style={diffEmpty}>변경 사항이 없습니다.</div>;
  return (
    <div style={diffBox}>
      {parts.map(([op, data], i) => {
        if (op === DIFF_INSERT) return <span key={i} style={ins}>{data}</span>;
        if (op === DIFF_DELETE) return <span key={i} style={del}>{data}</span>;
        return <span key={i}>{data}</span>;
      })}
    </div>
  );
}

const lead: React.CSSProperties = { margin: "0 0 18px", fontSize: 13.5, color: c.sub };
const emptyBox: React.CSSProperties = { border: `1px dashed ${c.line2}`, borderRadius: radius.card, background: c.soft, padding: "40px 24px", textAlign: "center", color: c.sub, fontSize: 14 };
const master: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 16, alignItems: "start" };
const listCol: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "46px minmax(0,1fr) 16px 16px", alignItems: "center", gap: 8, textAlign: "left", cursor: "pointer", border: `1px solid ${c.line}`, borderRadius: radius.control, background: "#fff", padding: "11px 12px" };
const rowOn: React.CSSProperties = { ...row, borderColor: c.brand, background: c.brandTint };
const seq: React.CSSProperties = { fontVariantNumeric: "tabular-nums", fontSize: 12, color: c.faint };
const preview: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: c.ink };
const detailCol: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16, minWidth: 0 };
const dEyebrow: React.CSSProperties = { fontSize: 12.5, color: c.sub, fontWeight: 500 };
const card: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: 20, boxShadow: shadow.card };
const cardHero: React.CSSProperties = { ...card, borderColor: c.brandBorder };
const cardTitle: React.CSSProperties = { fontSize: 14.5, fontWeight: 700, color: c.ink, letterSpacing: "-0.2px", marginBottom: 14 };
const two: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
const col: React.CSSProperties = { display: "flex", flexDirection: "column", minWidth: 0 };
const cmpLabel: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, fontWeight: 600, color: c.sub, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 7 };
const ro: React.CSSProperties = { whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14, color: c.ink, background: c.panel, border: `1px solid ${c.line}`, borderRadius: radius.control, padding: "11px 13px" };
const diffBox: React.CSSProperties = { whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 14, color: c.ink, background: c.panel, border: `1px solid ${c.line}`, borderRadius: radius.control, padding: "11px 13px" };
const diffEmpty: React.CSSProperties = { fontSize: 13, color: c.faint, background: c.panel, border: `1px dashed ${c.line2}`, borderRadius: radius.control, padding: "12px 13px" };
const legend: React.CSSProperties = { display: "inline-flex", gap: 8, textTransform: "none", letterSpacing: 0 };
const ins: React.CSSProperties = { background: "#d6efce", color: "#1f5b21", borderRadius: 3, padding: "0 2px" };
const del: React.CSSProperties = { background: "#fbd9d4", color: "#a13b34", textDecoration: "line-through", borderRadius: 3, padding: "0 2px" };
const tags: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 7 };
const tag: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: c.brandText, background: c.brandTint, border: `1px solid ${c.brandBorder}`, borderRadius: 999, padding: "3px 11px" };
const note: React.CSSProperties = { marginTop: 12, whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 13.5, color: c.ink, background: c.soft, border: `1px solid ${c.line}`, borderRadius: radius.control, padding: "11px 13px" };
