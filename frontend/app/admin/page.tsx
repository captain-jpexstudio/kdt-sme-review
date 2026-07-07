"use client";

import { Activity, ChevronRight, Download, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getAdminStats, type AdminStats } from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { c, radius, shadow } from "@/lib/theme";
import { Metric, S, useAdminGuard } from "./ui";

export default function AdminDashboardPage() {
  const ready = useAdminGuard();
  const [stats, setStats] = useState<AdminStats | null>(null);

  const refresh = useCallback(async () => {
    setStats(await getAdminStats());
  }, []);

  useEffect(() => {
    if (ready) refresh().catch(() => undefined);
  }, [ready, refresh]);

  if (!ready || !stats) return <main style={S.loading}>확인 중…</main>;

  return (
    <Shell
      role="admin"
      title="대시보드"
      right={
        <>
          <a href="/admin/export" style={S.secondaryButton}><Download size={16} /> 내보내기</a>
          <button onClick={() => refresh()} style={S.secondaryButton}><RefreshCw size={16} /> 새로고침</button>
        </>
      }
    >
      <section style={S.summaryGrid}>
        <Metric label="완료율" value={`${Math.round(stats.progress_pct)}%`} foot={`전체 ${stats.completed}/${stats.total_tasks}`} accent />
        <Metric label="검수자" value={`${stats.reviewers}`} foot="배정 인원" />
        <Metric label="작업중" value={`${stats.in_progress}`} foot={stats.rejected > 0 ? `진행 중 문항 · 폐기 ${stats.rejected}건 별도` : "진행 중 문항"} />
        <Metric label="잠금" value={`${stats.locked_reviewers}`} foot="최종 제출 잠금" />
      </section>

      <div style={quickGrid}>
        <a href="/admin/reviewers" style={quickCard}>
          <span style={quickIcon}><Users size={20} /></span>
          <div style={quickBody}>
            <b style={quickTitle}>검수자 진행률</b>
            <span style={quickDesc}>검수자별 진행·품질·서명 증빙 확인 및 잠금 해제</span>
          </div>
          <ChevronRight size={18} color={c.faint} />
        </a>
        <a href="/admin/events" style={quickCard}>
          <span style={quickIcon}><Activity size={20} /></span>
          <div style={quickBody}>
            <b style={quickTitle}>실시간 이벤트</b>
            <span style={quickDesc}>저장·제출·잠금 이벤트 실시간 스트림(SSE)</span>
          </div>
          <ChevronRight size={18} color={c.faint} />
        </a>
      </div>
    </Shell>
  );
}

const quickGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 16 };
const quickCard: React.CSSProperties = { display: "flex", alignItems: "center", gap: 14, border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: "18px 20px", textDecoration: "none", color: c.ink, boxShadow: shadow.card };
const quickIcon: React.CSSProperties = { width: 42, height: 42, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: radius.control, background: c.brandTint, color: c.brandText };
const quickBody: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 };
const quickTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: "-0.2px" };
const quickDesc: React.CSSProperties = { fontSize: 12.5, color: c.sub };
