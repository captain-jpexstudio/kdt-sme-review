"use client";

import { FileCheck, FileText, LockOpen, PenLine, Radio, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  agreementPdfUrl,
  finalPdfUrl,
  getReviewers,
  getReviewerSignatures,
  signatureImageUrl,
  unlockReviewer,
  type ReviewerProgress,
  type SignatureInfo,
} from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { c, radius, shadow } from "@/lib/theme";
import { S, useAdminGuard, useAudit } from "../ui";

export default function ReviewersPage() {
  const ready = useAdminGuard();
  const [reviewers, setReviewers] = useState<ReviewerProgress[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sigs, setSigs] = useState<Record<string, SignatureInfo[]>>({});
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await getReviewers();
    setReviewers(r);
    setSelected((cur) => cur ?? r[0]?.user_id ?? null);
  }, []);

  useEffect(() => {
    if (ready) refresh().catch(() => setError("검수자 목록을 불러오지 못했습니다."));
  }, [ready, refresh]);

  const { connected } = useAudit(() => refresh().catch(() => undefined));

  const loadSigs = useCallback(async (userId: string) => {
    if (sigs[userId]) return;
    try {
      const list = await getReviewerSignatures(userId);
      setSigs((prev) => ({ ...prev, [userId]: list }));
    } catch {
      setError("서명 증빙을 불러오지 못했습니다.");
    }
  }, [sigs]);

  useEffect(() => {
    if (selected) loadSigs(selected);
  }, [selected, loadSigs]);

  const unlock = async (userId: string) => {
    setError(null);
    try {
      await unlockReviewer(userId);
      await refresh();
    } catch {
      setError("잠금 해제에 실패했습니다.");
    }
  };

  if (!ready) return <main style={S.loading}>확인 중…</main>;

  const cur = reviewers.find((r) => r.user_id === selected) ?? null;

  return (
    <Shell
      role="admin"
      title="검수자 진행률"
      right={
        <>
          <span style={connected ? S.liveOn : S.liveOff}><Radio size={14} /> {connected ? "실시간" : "대기"}</span>
          <button onClick={() => refresh()} style={S.secondaryButton}><RefreshCw size={16} /> 새로고침</button>
        </>
      }
    >
      {error && <div style={S.errorBox}>{error}</div>}
      <div style={master} className="adm-master">
        {/* 목록 */}
        <div style={listCol}>
          {reviewers.length === 0 && <div style={S.empty}>검수자가 없습니다.</div>}
          {reviewers.map((r) => (
            <button
              key={r.user_id}
              onClick={() => setSelected(r.user_id)}
              style={r.user_id === selected ? listItemOn : listItem}
            >
              <div style={listTop}>
                <b style={{ fontSize: 14 }}>{r.reviewer_code ?? r.username}</b>
                <span style={r.locked ? lockPill : livePill}>{r.locked ? "잠김" : "진행"}</span>
              </div>
              <div style={listMeta}>{r.completed}/{r.total} · {Math.round(r.progress_pct)}%</div>
              <div style={S.barTrack}><div style={{ ...S.barFill, width: `${r.progress_pct}%` }} /></div>
            </button>
          ))}
        </div>

        {/* 유저별 상세 */}
        <div style={detailCol}>
          {!cur && <div style={S.empty}>검수자를 선택하세요.</div>}
          {cur && (
            <>
              <div style={detailHead}>
                <div>
                  <div style={eyebrow}>검수자 상세</div>
                  <h2 style={detailName}>{cur.reviewer_code ?? cur.username}</h2>
                </div>
                <span style={cur.locked ? lockPill : livePill}>{cur.locked ? "최종 제출 잠김" : "진행 중"}</span>
              </div>

              <div style={statGrid}>
                <Stat label="완료" value={`${cur.completed}`} />
                <Stat label="작업중" value={`${cur.in_progress}`} />
                <Stat label="대기" value={`${cur.pending}`} />
                <Stat label="전체" value={`${cur.total}`} />
              </div>
              <div style={{ ...S.barTrack, height: 10, margin: "4px 0 2px" }}><div style={{ ...S.barFill, width: `${cur.progress_pct}%` }} /></div>
              <div style={S.quality}>
                <span>진행률 <b>{Math.round(cur.progress_pct)}%</b></span>
                <span>평균 변경률 <b>{cur.avg_change_ratio == null ? "-" : `${Math.round(cur.avg_change_ratio * 100)}%`}</b></span>
                <span>의심(변경량 낮음) <b>{cur.trivial_count}</b></span>
                <span>최근 활동 {cur.last_activity_at ? new Date(cur.last_activity_at).toLocaleString("ko-KR") : "-"}</span>
              </div>

              <div style={actionRow}>
                <a href={agreementPdfUrl(cur.user_id)} target="_blank" rel="noreferrer" style={S.linkButton}><FileText size={14} /> 동의서 PDF</a>
                <a
                  href={cur.batch_submitted_at ? finalPdfUrl(cur.user_id) : undefined}
                  target="_blank"
                  rel="noreferrer"
                  style={cur.batch_submitted_at ? S.linkButton : S.disabledLink}
                  onClick={(e) => { if (!cur.batch_submitted_at) e.preventDefault(); }}
                >
                  <FileCheck size={14} /> 최종본 PDF
                </a>
                <button onClick={() => unlock(cur.user_id)} disabled={!cur.locked} style={cur.locked ? S.unlockButton : S.disabledButton}>
                  <LockOpen size={15} /> 잠금 해제
                </button>
              </div>

              <div style={sigWrap}>
                <div style={sigTitle}><PenLine size={15} /> 서명 증빙</div>
                {(sigs[cur.user_id] ?? []).length === 0 && <div style={S.empty}>서명 증빙이 없습니다.</div>}
                <div style={S.sigPanel}>
                  {(sigs[cur.user_id] ?? []).map((s) => (
                    <figure key={s.id} style={S.sigFigure}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={signatureImageUrl(s.id)} alt={`${s.kind} 서명`} style={S.sigImg} />
                      <figcaption style={S.sigCaption}>
                        <b>{s.kind === "agreement" ? "동의·보안서약" : "최종제출·이관"}</b>
                        <span>{new Date(s.created_at).toLocaleString("ko-KR")}</span>
                        <span style={S.sigHash}>sha256 {s.sha256.slice(0, 12)}…</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={statBox}>
      <span style={statLabel}>{label}</span>
      <b style={statValue}>{value}</b>
    </div>
  );
}

const master: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(280px, 340px) 1fr", gap: 16, alignItems: "start" };
const listCol: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const listItem: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 7, textAlign: "left", cursor: "pointer", border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: "13px 15px" };
const listItemOn: React.CSSProperties = { ...listItem, borderColor: c.brand, background: c.brandTint };
const listTop: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
const listMeta: React.CSSProperties = { fontSize: 12.5, color: c.sub };
const detailCol: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: 22, boxShadow: shadow.card, minHeight: 200 };
const detailHead: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 };
const eyebrow: React.CSSProperties = { fontSize: 12, color: c.sub, fontWeight: 500, marginBottom: 4 };
const detailName: React.CSSProperties = { margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px" };
const statGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 };
const statBox: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.control, background: c.soft, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 5 };
const statLabel: React.CSSProperties = { fontSize: 12, color: c.sub, fontWeight: 500 };
const statValue: React.CSSProperties = { fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: c.ink };
const actionRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0", paddingTop: 16, borderTop: `1px solid ${c.line}` };
const sigWrap: React.CSSProperties = { paddingTop: 4 };
const sigTitle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 700, color: c.ink, marginBottom: 10 };
const livePill: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: c.brandText, background: c.brandTint, border: `1px solid ${c.brandBorder}`, borderRadius: 999, padding: "2px 9px" };
const lockPill: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: c.warnText, background: c.warnBg, border: `1px solid ${c.warnBorder}`, borderRadius: 999, padding: "2px 9px" };
