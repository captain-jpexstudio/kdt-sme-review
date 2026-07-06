"use client";

import { Radio } from "lucide-react";

import { Shell } from "@/components/Shell";
import { c, radius } from "@/lib/theme";
import { S, useAdminGuard, useAudit } from "../ui";

const LABEL: Record<string, string> = {
  AUTOSAVE: "임시저장",
  SUBMIT: "제출",
  BATCH_SUBMIT: "최종 제출",
  BATCH_UNLOCK: "잠금 해제",
  REJECT: "폐기",
};

export default function EventsPage() {
  const ready = useAdminGuard();
  const { connected, events } = useAudit();

  if (!ready) return <main style={S.loading}>확인 중…</main>;

  return (
    <Shell
      role="admin"
      title="실시간 이벤트"
      right={<span style={connected ? S.liveOn : S.liveOff}><Radio size={14} /> {connected ? "SSE 연결됨" : "SSE 대기"}</span>}
    >
      <p style={S.pageLead}>검수자들의 임시저장·제출·최종제출·잠금해제가 실시간(SSE)으로 표시됩니다. 최근 50건까지 유지됩니다.</p>
      <div style={feed}>
        <div style={feedHead}>
          <span>유형</span>
          <span>검수자</span>
          <span>문항</span>
          <span>시각</span>
        </div>
        {events.length === 0 && <div style={S.empty}>아직 수신된 이벤트가 없습니다. 검수자가 활동하면 여기에 표시됩니다.</div>}
        {events.map((ev, i) => (
          <div key={`${ev.type}-${ev.task_id ?? ""}-${i}`} style={row} className="adm-event-row">
            <span style={typePill}>{LABEL[ev.type] ?? ev.type}</span>
            <span>{ev.reviewer_code ?? "-"}</span>
            <span style={{ fontFamily: "monospace", color: c.sub }}>{ev.task_id ? ev.task_id.slice(0, 8) : "-"}</span>
            <span style={{ color: c.sub }}>{ev.ts ?? "-"}</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const feed: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: "8px 20px 12px" };
const feedHead: React.CSSProperties = { display: "grid", gridTemplateColumns: "130px 130px 110px minmax(0,1fr)", gap: 10, padding: "12px 0 10px", fontSize: 12, fontWeight: 600, color: c.sub, borderBottom: `1px solid ${c.line}` };
const row: React.CSSProperties = { display: "grid", gridTemplateColumns: "130px 130px 110px minmax(0,1fr)", gap: 10, fontSize: 13, borderTop: `1px solid ${c.line}`, padding: "10px 0", alignItems: "center" };
const typePill: React.CSSProperties = { justifySelf: "start", fontSize: 12, fontWeight: 600, color: c.brandText, background: c.brandTint, border: `1px solid ${c.brandBorder}`, borderRadius: 999, padding: "2px 10px" };
