"use client";

import { FileCheck, FileText, LockOpen, PenLine, Radio, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  agreementPdfUrl,
  completeAllTasks,
  finalPdfUrl,
  getReviewers,
  getReviewerSignatures,
  resetReviewerTasks,
  signatureImageUrl,
  unlockReviewer,
  type ReviewerProgress,
  type SignatureInfo,
} from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { c, radius, shadow } from "@/lib/theme";
import { S, useAdminGuard, useAudit } from "../ui";
import { TasksPanel } from "./tasks-panel";

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

  // 테스트용 일괄 완료 — 최종 제출→계좌 플로우 점검용. 복원은 작업 리셋.
  const completeAll = async (r: ReviewerProgress) => {
    const code = r.reviewer_code ?? r.username;
    const ok = window.confirm(
      `[테스트용] ${code}의 미완료 문항을 전부 완료 처리합니다.\n\n` +
        "- 수정본이 없는 문항은 원본이 그대로 복사됩니다 (실검수 아님!)\n" +
        "- 이후 검수자 화면에서 최종 제출·계좌 입력 플로우를 테스트할 수 있습니다\n" +
        "- 되돌리려면 [작업 리셋]을 사용하세요\n\n진행할까요?",
    );
    if (!ok) return;
    setError(null);
    try {
      const res = await completeAllTasks(r.user_id);
      await refresh();
      window.alert(`일괄 완료 처리: ${res.completed}건. 이제 ${code} 계정으로 최종 제출을 테스트하세요.`);
    } catch {
      setError("일괄 완료 처리에 실패했습니다.");
    }
  };

  // 작업 리셋 — 파괴적 작업이라 검수자 코드를 직접 입력해야 실행
  const reset = async (r: ReviewerProgress) => {
    const code = r.reviewer_code ?? r.username;
    const typed = window.prompt(
      `${code}의 검수 작업을 전부 초기화합니다.\n\n` +
        "- 모든 문항이 최초 배정 상태(대기·무편집)로 돌아갑니다\n" +
        "- 임시저장·제출본·오류 태깅이 삭제됩니다 (복구 불가)\n" +
        "- 폐기 대체로 받은 예비 문항은 회수되고, 최종 제출 잠금도 해제됩니다\n" +
        "- 서명·동의 증빙과 감사 로그는 보존됩니다\n\n" +
        `진행하려면 검수자 코드(${code})를 그대로 입력하세요:`,
    );
    if (typed === null) return;
    if (typed.trim() !== code) {
      window.alert("입력한 코드가 일치하지 않아 취소했습니다.");
      return;
    }
    setError(null);
    try {
      const res = await resetReviewerTasks(r.user_id);
      await refresh();
      window.alert(`리셋 완료 · 문항 ${res.reset}건 초기화, 예비 회수 ${res.replacements_removed}건${res.unlocked ? ", 잠금 해제됨" : ""}`);
    } catch {
      setError("작업 리셋에 실패했습니다.");
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
                {cur.rejected > 0 && <span>폐기(예비로 대체됨) <b>{cur.rejected}</b></span>}
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
                <button onClick={() => completeAll(cur)} title="테스트용: 미완료 문항 전부 완료 처리(원본 복사). 복원은 작업 리셋" style={bulkButton}>
                  <FileCheck size={14} /> 일괄 완료 (테스트)
                </button>
                <button onClick={() => reset(cur)} title="모든 문항을 최초 배정 상태로 초기화(복구 불가)" style={resetButton}>
                  <RotateCcw size={14} /> 작업 리셋 (복원)
                </button>
              </div>

              <TasksPanel userId={cur.user_id} />

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
const bulkButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${c.warnBorder}`, background: c.warnBg, color: c.warnText, borderRadius: radius.control, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginLeft: "auto" };
const resetButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${c.dangerBorder}`, background: "#fff", color: c.danger, borderRadius: radius.control, padding: "7px 13px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const livePill: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: c.brandText, background: c.brandTint, border: `1px solid ${c.brandBorder}`, borderRadius: 999, padding: "2px 9px" };
const lockPill: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: c.warnText, background: c.warnBg, border: `1px solid ${c.warnBorder}`, borderRadius: 999, padding: "2px 9px" };
