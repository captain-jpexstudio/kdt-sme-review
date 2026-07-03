"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { getMe } from "@/lib/auth";
import { c, radius } from "@/lib/theme";

export interface LiveEvent {
  type: string;
  reviewer_code?: string;
  task_id?: string;
  ts?: string;
}

// admin 전용 가드 — 비관리자는 리다이렉트
export function useAdminGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    getMe()
      .then((me) => {
        if (me.role !== "admin") {
          router.replace("/workspace");
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);
  return ready;
}

// 감사 SSE 스트림 — 연결상태 + 최근 이벤트, 이벤트 콜백(리렌더 없이 최신 유지)
export function useAudit(onEvent?: (e: LiveEvent) => void) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const cb = useRef(onEvent);
  cb.current = onEvent;
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost/api/v1";
    const es = new EventSource(`${base}/admin/audit/stream`, { withCredentials: true });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    const onAny = (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data) as LiveEvent;
        setEvents((prev) => [parsed, ...prev].slice(0, 50));
        cb.current?.(parsed);
      } catch {
        /* malformed */
      }
    };
    ["AUTOSAVE", "SUBMIT", "BATCH_SUBMIT", "BATCH_UNLOCK"].forEach((n) => es.addEventListener(n, onAny));
    return () => es.close();
  }, []);
  return { connected, events };
}

export function Metric({ label, value, foot, accent }: { label: string; value: string; foot?: string; accent?: boolean }) {
  return (
    <div style={S.metric}>
      <span style={S.metricLabel}>{label}</span>
      <b style={accent ? S.metricNumAccent : S.metricNum}>{value}</b>
      {foot && <div style={S.metricFoot}>{foot}</div>}
    </div>
  );
}

export const S = {
  loading: { padding: 40, color: c.sub } as React.CSSProperties,
  pageTitle: { margin: "0 0 4px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px", color: c.ink } as React.CSSProperties,
  pageLead: { margin: "0 0 20px", fontSize: 13.5, color: c.sub } as React.CSSProperties,
  errorBox: { border: `1px solid ${c.dangerBorder}`, background: c.dangerBg, color: c.danger, borderRadius: radius.control, padding: "11px 13px", marginBottom: 12, fontSize: 13 } as React.CSSProperties,
  // 지표 카드
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(150px, 100%), 1fr))", gap: 16, marginBottom: 16 } as React.CSSProperties,
  metric: { border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: "18px 20px 16px", display: "flex", flexDirection: "column", gap: 14, minHeight: 128 } as React.CSSProperties,
  metricLabel: { fontSize: 14, fontWeight: 600, color: c.ink } as React.CSSProperties,
  metricNum: { fontSize: 42, fontWeight: 700, letterSpacing: "-1.5px", color: c.ink, lineHeight: 1 } as React.CSSProperties,
  metricNumAccent: { fontSize: 42, fontWeight: 700, letterSpacing: "-1.5px", color: c.brand, lineHeight: 1 } as React.CSSProperties,
  metricFoot: { fontSize: 12.5, color: c.faint, borderTop: `1px solid ${c.line}`, paddingTop: 10, marginTop: "auto" } as React.CSSProperties,
  // 패널/카드
  panel: { border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: 22, marginBottom: 16 } as React.CSSProperties,
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 } as React.CSSProperties,
  panelTitle: { margin: "0 0 14px", fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px" } as React.CSSProperties,
  // 버튼
  primaryButton: { height: 38, display: "inline-flex", alignItems: "center", gap: 7, borderRadius: radius.control, border: "1px solid transparent", background: c.brand, color: "#fff", padding: "0 14px", fontWeight: 600, textDecoration: "none", cursor: "pointer" } as React.CSSProperties,
  secondaryButton: { height: 38, display: "inline-flex", alignItems: "center", gap: 7, borderRadius: radius.control, border: `1px solid ${c.line2}`, background: "#fff", color: c.ink, padding: "0 14px", fontWeight: 500, textDecoration: "none", cursor: "pointer" } as React.CSSProperties,
  linkButton: { height: 32, display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", color: c.ink, padding: "0 10px", fontSize: 12, fontWeight: 500, textDecoration: "none", cursor: "pointer" } as React.CSSProperties,
  disabledLink: { height: 32, display: "inline-flex", alignItems: "center", gap: 5, border: `1px solid ${c.line}`, borderRadius: radius.control, background: c.panel, color: c.faint, padding: "0 10px", fontSize: 12, fontWeight: 500, textDecoration: "none", cursor: "not-allowed" } as React.CSSProperties,
  unlockButton: { height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${c.warnBorder}`, borderRadius: radius.control, background: c.warnBg, color: c.warnText, fontWeight: 500, cursor: "pointer" } as React.CSSProperties,
  disabledButton: { height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, border: `1px solid ${c.line}`, borderRadius: radius.control, background: "#f2f4ef", color: c.faint, fontWeight: 500, cursor: "not-allowed" } as React.CSSProperties,
  // 진행 바
  barTrack: { height: 8, borderRadius: radius.pill, background: "#ececec", overflow: "hidden" } as React.CSSProperties,
  barFill: { height: "100%", background: `linear-gradient(90deg, ${c.brand}, ${c.brandStrong})`, borderRadius: radius.pill } as React.CSSProperties,
  // 배지/기타
  liveOn: { display: "inline-flex", alignItems: "center", gap: 6, color: c.brand, fontSize: 13, fontWeight: 500 } as React.CSSProperties,
  liveOff: { display: "inline-flex", alignItems: "center", gap: 6, color: c.faint, fontSize: 13, fontWeight: 500 } as React.CSSProperties,
  empty: { color: c.sub, fontSize: 13, padding: "8px 0" } as React.CSSProperties,
  batchInput: { height: 38, border: `1px solid ${c.line2}`, borderRadius: radius.control, padding: "0 11px", fontSize: 13, width: 150, background: "#fff", color: c.ink } as React.CSSProperties,
  quality: { display: "flex", gap: 10, color: c.sub, fontSize: 13, flexWrap: "wrap" } as React.CSSProperties,
  // 서명 증빙
  sigPanel: { display: "flex", gap: 14, flexWrap: "wrap" } as React.CSSProperties,
  sigFigure: { margin: 0, border: `1px solid ${c.line}`, borderRadius: radius.control, padding: 9, background: c.panel } as React.CSSProperties,
  sigImg: { display: "block", width: 220, height: 100, objectFit: "contain", background: "#fff", border: `1px solid ${c.line}`, borderRadius: 6 } as React.CSSProperties,
  sigCaption: { display: "grid", gap: 2, marginTop: 6, fontSize: 12, color: c.ink } as React.CSSProperties,
  sigHash: { fontFamily: "monospace", fontSize: 10, color: c.faint } as React.CSSProperties,
};
