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

interface LiveEvent {
  type: string;
  reviewer_code?: string;
  task_id?: string;
  ts?: string;
}

export default function AdminPage() {
  const router = useRouter();
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
    <main style={page}>
      <header style={header}>
        <div>
          <div style={eyebrow}>관리자 대시보드</div>
          <h1 style={title}>전체 {stats.completed} / {stats.total_tasks}</h1>
        </div>
        <div style={actions}>
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
        </div>
      </header>

      {error && <div style={errorBox}>{error}</div>}

      <section style={summaryGrid}>
        <Metric label="완료율" value={`${Math.round(stats.progress_pct)}%`} />
        <Metric label="검수자" value={`${stats.reviewers}명`} />
        <Metric label="작업중" value={`${stats.in_progress}`} />
        <Metric label="잠금" value={`${stats.locked_reviewers}`} />
      </section>

      <section style={panel}>
        <div style={panelHeader}>
          <h2 style={panelTitle}>검수자 진행률</h2>
          <span style={connected ? liveOn : liveOff}><Radio size={14} /> {connected ? "SSE 연결" : "SSE 대기"}</span>
        </div>
        <div style={reviewerList}>
          {reviewers.map((r) => (
            <div key={r.user_id} style={reviewerBlock}>
              <div style={reviewerRow}>
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

      <section style={panel}>
        <h2 style={panelTitle}>실시간 이벤트</h2>
        {events.length === 0 && <div style={empty}>아직 수신된 이벤트가 없습니다.</div>}
        {events.map((ev, i) => (
          <div key={`${ev.type}-${ev.task_id ?? ""}-${i}`} style={eventRow}>
            <b>{ev.type}</b>
            <span>{ev.reviewer_code ?? "-"}</span>
            <span>{ev.task_id ? ev.task_id.slice(0, 8) : ""}</span>
            <span>{ev.ts ?? ""}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metric}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

const loading: React.CSSProperties = { padding: 40, fontFamily: "system-ui", color: "#6b7280" };
const page: React.CSSProperties = { minHeight: "100vh", padding: 24, fontFamily: "system-ui", background: "#f7f8f5", color: "#111827" };
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 18 };
const eyebrow: React.CSSProperties = { fontSize: 12, color: "#6b7280", marginBottom: 4 };
const title: React.CSSProperties = { margin: 0, fontSize: 28 };
const actions: React.CSSProperties = { display: "flex", gap: 8 };
const primaryButton: React.CSSProperties = { height: 36, display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 6, border: "1px solid #1d6f61", background: "#1d6f61", color: "#fff", padding: "0 12px", textDecoration: "none", cursor: "pointer" };
const secondaryButton: React.CSSProperties = { ...primaryButton, borderColor: "#cfd3ca", background: "#fff", color: "#374151" };
const errorBox: React.CSSProperties = { border: "1px solid #e2a4a4", background: "#fff1f1", color: "#9f2222", borderRadius: 6, padding: "10px 12px", marginBottom: 12, fontSize: 13 };
const summaryGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 };
const metric: React.CSSProperties = { border: "1px solid #d7d9d2", borderRadius: 6, background: "#fff", padding: 14, display: "grid", gap: 6 };
const panel: React.CSSProperties = { border: "1px solid #d7d9d2", borderRadius: 6, background: "#fff", padding: 16, marginBottom: 16 };
const panelHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 };
const panelTitle: React.CSSProperties = { margin: "0 0 12px", fontSize: 18 };
const liveOn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, color: "#0f766e", fontSize: 13 };
const liveOff: React.CSSProperties = { ...liveOn, color: "#9ca3af" };
const reviewerList: React.CSSProperties = { display: "grid", gap: 8 };
const reviewerBlock: React.CSSProperties = { borderTop: "1px solid #eef0ea" };
const reviewerRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "170px minmax(140px,1fr) 220px auto", gap: 12, alignItems: "center", padding: "10px 0" };
const rowActions: React.CSSProperties = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" };
const linkButton: React.CSSProperties = { height: 30, display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #cfd3ca", borderRadius: 6, background: "#fff", color: "#374151", padding: "0 9px", fontSize: 12, textDecoration: "none", cursor: "pointer" };
const disabledLink: React.CSSProperties = { ...linkButton, borderColor: "#e5e7eb", color: "#b6bac1", background: "#f7f8f5", cursor: "not-allowed" };
const ghostButton: React.CSSProperties = { ...linkButton };
const ghostButtonOn: React.CSSProperties = { ...linkButton, borderColor: "#1d6f61", color: "#1d6f61", background: "#eef6f3" };
const sigPanel: React.CSSProperties = { display: "flex", gap: 14, flexWrap: "wrap", padding: "4px 0 14px" };
const sigFigure: React.CSSProperties = { margin: 0, border: "1px solid #e5e7df", borderRadius: 6, padding: 8, background: "#fafbf8" };
const sigImg: React.CSSProperties = { display: "block", width: 220, height: 100, objectFit: "contain", background: "#fff", border: "1px solid #eef0ea", borderRadius: 4 };
const sigCaption: React.CSSProperties = { display: "grid", gap: 2, marginTop: 6, fontSize: 12, color: "#374151" };
const sigHash: React.CSSProperties = { fontFamily: "monospace", fontSize: 10, color: "#9ca3af" };
const batchInput: React.CSSProperties = { height: 36, border: "1px solid #cfd3ca", borderRadius: 6, padding: "0 10px", fontSize: 13, width: 150 };
const reviewerMeta: React.CSSProperties = { display: "grid", gap: 3, fontSize: 13 };
const barTrack: React.CSSProperties = { height: 9, borderRadius: 999, background: "#e5e7df", overflow: "hidden" };
const barFill: React.CSSProperties = { height: "100%", background: "#1d6f61" };
const quality: React.CSSProperties = { display: "flex", gap: 10, color: "#6b7280", fontSize: 13 };
const unlockButton: React.CSSProperties = { height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: "1px solid #b45309", borderRadius: 6, background: "#fff8e6", color: "#92400e", cursor: "pointer" };
const disabledButton: React.CSSProperties = { ...unlockButton, borderColor: "#d1d5db", background: "#f3f4f6", color: "#9ca3af", cursor: "not-allowed" };
const empty: React.CSSProperties = { color: "#6b7280", fontSize: 13 };
const eventRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "120px 120px 100px minmax(0,1fr)", gap: 10, fontSize: 13, borderTop: "1px solid #eef0ea", padding: "8px 0" };
