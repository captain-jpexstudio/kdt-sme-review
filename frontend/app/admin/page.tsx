"use client";

import { Download, FileText, FileCheck, LockOpen, PenLine, RefreshCw, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  agreementPdfUrl,
  exportUrl,
  finalPdfUrl,
  getAdminStats,
  getReviewers,
  getReviewerSignatures,
  signatureImageUrl,
  unlockReviewer,
  type AdminStats,
  type ReviewerProgress,
  type SignatureInfo,
} from "@/lib/admin";
import { getMe } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { useIsMobile } from "@/lib/useIsMobile";
import { c, radius } from "@/lib/theme";

interface LiveEvent {
  type: string;
  reviewer_code?: string;
  task_id?: string;
  ts?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [ready, setReady] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reviewers, setReviewers] = useState<ReviewerProgress[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [sigOpen, setSigOpen] = useState<string | null>(null);
  const [sigs, setSigs] = useState<Record<string, SignatureInfo[]>>({});

  const refresh = useCallback(async () => {
    const [s, r] = await Promise.all([getAdminStats(), getReviewers()]);
    setStats(s);
    setReviewers(r);
  }, []);

  useEffect(() => {
    getMe()
      .then(async (me) => {
        if (me.role !== "admin") {
          router.replace("/workspace");
          return;
        }
        await refresh();
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [refresh, router]);

  useEffect(() => {
    if (!ready) return;
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost/api/v1";
    const es = new EventSource(`${base}/admin/audit/stream`, { withCredentials: true });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    const onAny = (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data) as LiveEvent;
        setEvents((prev) => [parsed, ...prev].slice(0, 20));
        refresh().catch(() => undefined);
      } catch {
        // ignore malformed SSE payloads
      }
    };
    ["AUTOSAVE", "SUBMIT", "BATCH_SUBMIT", "BATCH_UNLOCK"].forEach((name) => es.addEventListener(name, onAny));
    return () => es.close();
  }, [ready, refresh]);

  const unlock = async (r: ReviewerProgress) => {
    setError(null);
    try {
      await unlockReviewer(r.user_id);
      await refresh();
    } catch {
      setError("잠금 해제에 실패했습니다.");
    }
  };

  const toggleSignatures = async (r: ReviewerProgress) => {
    if (sigOpen === r.user_id) {
      setSigOpen(null);
      return;
    }
    setSigOpen(r.user_id);
    if (!sigs[r.user_id]) {
      try {
        const list = await getReviewerSignatures(r.user_id);
        setSigs((prev) => ({ ...prev, [r.user_id]: list }));
      } catch {
        setError("서명 증빙을 불러오지 못했습니다.");
      }
    }
  };

  if (!ready || !stats) return <main style={loading}>확인 중…</main>;

  return (
    <Shell
      role="admin"
      title="대시보드"
      right={
        <>
          <input
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="batch_id (선택)"
            style={batchInput}
          />
          <a href={exportUrl(batchId.trim() || undefined)} style={primaryButton}>
            <Download size={16} /> Export{batchId.trim() ? ` (${batchId.trim()})` : ""}
          </a>
          <button onClick={() => refresh()} style={secondaryButton}><RefreshCw size={16} /> 새로고침</button>
        </>
      }
    >
      {error && <div style={errorBox}>{error}</div>}

      <section style={summaryGrid}>
        <Metric label="완료율" value={`${Math.round(stats.progress_pct)}%`} foot={`전체 ${stats.completed}/${stats.total_tasks}`} accent />
        <Metric label="검수자" value={`${stats.reviewers}`} foot="배정 인원" />
        <Metric label="작업중" value={`${stats.in_progress}`} foot="진행 중 문항" />
        <Metric label="잠금" value={`${stats.locked_reviewers}`} foot="최종 제출 잠금" />
      </section>

      <section style={panel} id="reviewers">
        <div style={panelHeader}>
          <h2 style={panelTitle}>검수자 진행률</h2>
          <span style={connected ? liveOn : liveOff}><Radio size={14} /> {connected ? "SSE 연결" : "SSE 대기"}</span>
        </div>
        <div style={reviewerList}>
          {reviewers.map((r) => (
            <div key={r.user_id} style={reviewerBlock}>
              <div style={isMobile ? reviewerRowMobile : reviewerRow}>
                <div style={reviewerMeta}>
                  <b>{r.reviewer_code ?? r.username}</b>
                  <span>{r.completed}/{r.total} · 작업중 {r.in_progress} · 대기 {r.pending}</span>
                </div>
                <div style={barTrack}><div style={{ ...barFill, width: `${r.progress_pct}%` }} /></div>
                <div style={quality}>
                  <span>평균 변경률 {r.avg_change_ratio == null ? "-" : `${Math.round(r.avg_change_ratio * 100)}%`}</span>
                  <span>의심 {r.trivial_count}</span>
                  <span>{r.locked ? "잠김" : "진행"}</span>
                </div>
                <div style={rowActions}>
                  <a href={agreementPdfUrl(r.user_id)} target="_blank" rel="noreferrer" style={linkButton}>
                    <FileText size={14} /> 동의서
                  </a>
                  <a
                    href={r.batch_submitted_at ? finalPdfUrl(r.user_id) : undefined}
                    target="_blank"
                    rel="noreferrer"
                    style={r.batch_submitted_at ? linkButton : disabledLink}
                    aria-disabled={!r.batch_submitted_at}
                    onClick={(e) => { if (!r.batch_submitted_at) e.preventDefault(); }}
                  >
                    <FileCheck size={14} /> 최종본
                  </a>
                  <button onClick={() => toggleSignatures(r)} style={sigOpen === r.user_id ? ghostButtonOn : ghostButton}>
                    <PenLine size={14} /> 서명
                  </button>
                  <button onClick={() => unlock(r)} disabled={!r.locked} style={r.locked ? unlockButton : disabledButton}>
                    <LockOpen size={15} /> Unlock
                  </button>
                </div>
              </div>
              {sigOpen === r.user_id && (
                <div style={sigPanel}>
                  {(sigs[r.user_id] ?? []).length === 0 && <div style={empty}>서명 증빙이 없습니다.</div>}
                  {(sigs[r.user_id] ?? []).map((s) => (
                    <figure key={s.id} style={sigFigure}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signatureImageUrl(s.id)} alt={`${s.kind} 서명`} style={sigImg} />
                      <figcaption style={sigCaption}>
                        <b>{s.kind === "agreement" ? "동의·보안서약" : "최종제출·이관"}</b>
                        <span>{new Date(s.created_at).toLocaleString("ko-KR")}</span>
                        <span style={sigHash}>sha256 {s.sha256.slice(0, 12)}…</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={panel} id="events">
        <h2 style={panelTitle}>실시간 이벤트</h2>
        {events.length === 0 && <div style={empty}>아직 수신된 이벤트가 없습니다.</div>}
        {events.map((ev, i) => (
          <div key={`${ev.type}-${ev.task_id ?? ""}-${i}`} style={isMobile ? eventRowMobile : eventRow}>
            <b>{ev.type}</b>
            <span>{ev.reviewer_code ?? "-"}</span>
            <span>{ev.task_id ? ev.task_id.slice(0, 8) : ""}</span>
            <span>{ev.ts ?? ""}</span>
          </div>
        ))}
      </section>
    </Shell>
  );
}

function Metric({ label, value, foot, accent }: { label: string; value: string; foot?: string; accent?: boolean }) {
  return (
    <div style={metric}>
      <span style={metricLabel}>{label}</span>
      <b style={accent ? metricNumAccent : metricNum}>{value}</b>
      {foot && <div style={metricFoot}>{foot}</div>}
    </div>
  );
}

const loading: React.CSSProperties = { padding: 40, color: c.sub };
const metricLabel: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: c.ink };
const metricNum: React.CSSProperties = { fontSize: 42, fontWeight: 700, letterSpacing: "-1.5px", color: c.ink, lineHeight: 1 };
const metricNumAccent: React.CSSProperties = { ...metricNum, color: c.brand };
const metricFoot: React.CSSProperties = { fontSize: 12.5, color: c.faint, borderTop: `1px solid ${c.line}`, paddingTop: 10, marginTop: "auto" };
const primaryButton: React.CSSProperties = { height: 38, display: "inline-flex", alignItems: "center", gap: 7, borderRadius: radius.control, border: "1px solid transparent", background: c.brand, color: "#fff", padding: "0 14px", fontWeight: 600, textDecoration: "none", cursor: "pointer" };
const secondaryButton: React.CSSProperties = { ...primaryButton, borderColor: c.line2, background: "#fff", color: c.ink, fontWeight: 500 };
const errorBox: React.CSSProperties = { border: `1px solid ${c.dangerBorder}`, background: c.dangerBg, color: c.danger, borderRadius: radius.control, padding: "11px 13px", marginBottom: 12, fontSize: 13 };
const summaryGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 16, marginBottom: 16 };
const metric: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: "18px 20px 16px", display: "flex", flexDirection: "column", gap: 14, minHeight: 128 };
const panel: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: 22, marginBottom: 16 };
const panelHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 };
const panelTitle: React.CSSProperties = { margin: "0 0 14px", fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" };
const liveOn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, color: c.brand, fontSize: 13, fontWeight: 500 };
const liveOff: React.CSSProperties = { ...liveOn, color: c.faint };
const reviewerList: React.CSSProperties = { display: "grid", gap: 8 };
const reviewerBlock: React.CSSProperties = { borderTop: `1px solid ${c.line}` };
const reviewerRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "170px minmax(140px,1fr) 220px auto", gap: 12, alignItems: "center", padding: "12px 0" };
const reviewerRowMobile: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch", padding: "14px 0" };
const rowActions: React.CSSProperties = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" };
const linkButton: React.CSSProperties = { height: 32, display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", color: c.ink, padding: "0 10px", fontSize: 12, fontWeight: 500, textDecoration: "none", cursor: "pointer" };
const disabledLink: React.CSSProperties = { ...linkButton, borderColor: c.line, color: c.faint, background: c.panel, cursor: "not-allowed" };
const ghostButton: React.CSSProperties = { ...linkButton };
const ghostButtonOn: React.CSSProperties = { ...linkButton, borderColor: c.brand, color: c.brandText, background: c.brandTint };
const sigPanel: React.CSSProperties = { display: "flex", gap: 14, flexWrap: "wrap", padding: "4px 0 14px" };
const sigFigure: React.CSSProperties = { margin: 0, border: `1px solid ${c.line}`, borderRadius: radius.control, padding: 9, background: c.panel };
const sigImg: React.CSSProperties = { display: "block", width: 220, height: 100, objectFit: "contain", background: "#fff", border: `1px solid ${c.line}`, borderRadius: 6 };
const sigCaption: React.CSSProperties = { display: "grid", gap: 2, marginTop: 6, fontSize: 12, color: c.ink };
const sigHash: React.CSSProperties = { fontFamily: "monospace", fontSize: 10, color: c.faint };
const batchInput: React.CSSProperties = { height: 38, border: `1px solid ${c.line2}`, borderRadius: radius.control, padding: "0 11px", fontSize: 13, width: 150, background: "#fff", color: c.ink };
const reviewerMeta: React.CSSProperties = { display: "grid", gap: 3, fontSize: 13 };
const barTrack: React.CSSProperties = { height: 8, borderRadius: radius.pill, background: "#ececec", overflow: "hidden" };
const barFill: React.CSSProperties = { height: "100%", background: `linear-gradient(90deg, ${c.brand}, ${c.brandStrong})`, borderRadius: radius.pill };
const quality: React.CSSProperties = { display: "flex", gap: 10, color: c.sub, fontSize: 13 };
const unlockButton: React.CSSProperties = { height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${c.warnBorder}`, borderRadius: radius.control, background: c.warnBg, color: c.warnText, fontWeight: 500, cursor: "pointer" };
const disabledButton: React.CSSProperties = { ...unlockButton, borderColor: c.line, background: "#f2f4ef", color: c.faint, cursor: "not-allowed" };
const empty: React.CSSProperties = { color: c.sub, fontSize: 13 };
const eventRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "120px 120px 100px minmax(0,1fr)", gap: 10, fontSize: 13, borderTop: `1px solid ${c.line}`, padding: "9px 0" };
const eventRowMobile: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 12.5, borderTop: `1px solid ${c.line}`, padding: "9px 0" };
