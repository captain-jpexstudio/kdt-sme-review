"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { getReviewers, type ReviewerProgress } from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { c, radius } from "@/lib/theme";
import { S, useAdminGuard } from "../ui";
import { TasksPanel } from "../reviewers/tasks-panel";

export default function AdminTasksPage() {
  const ready = useAdminGuard();
  if (!ready) return <main style={S.loading}>확인 중…</main>;
  return (
    <Shell role="admin" title="문항 목록">
      <Suspense fallback={<div style={S.loading}>불러오는 중…</div>}>
        <TasksView />
      </Suspense>
    </Shell>
  );
}

function TasksView() {
  const params = useSearchParams();
  const [reviewers, setReviewers] = useState<ReviewerProgress[]>([]);
  const [userId, setUserId] = useState<string | null>(params.get("user"));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReviewers()
      .then(setReviewers)
      .catch(() => setError("검수자 목록을 불러오지 못했습니다."));
  }, []);

  return (
    <>
      <p style={S.pageLead}>전체 문항을 한 화면에서 검토합니다. 검수자를 선택해 300문항 전체를 필터·대조하세요.</p>
      {error && <div style={S.errorBox}>{error}</div>}
      <div style={reviewerChips}>
        <button onClick={() => setUserId(null)} style={userId === null ? chipOn : chip}>전체</button>
        {reviewers.map((r) => (
          <button key={r.user_id} onClick={() => setUserId(r.user_id)} style={r.user_id === userId ? chipOn : chip}>
            {r.reviewer_code ?? r.username}
            <span style={chipMeta}>{r.completed}/{r.total}</span>
          </button>
        ))}
      </div>
      <div style={card}>
        <TasksPanel key={userId ?? "all"} userId={userId ?? undefined} full />
      </div>
    </>
  );
}

const reviewerChips: React.CSSProperties = { display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 };
const chip: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: c.sub, background: "#fff", border: `1px solid ${c.line2}`, borderRadius: 999, padding: "6px 14px", cursor: "pointer" };
const chipOn: React.CSSProperties = { ...chip, color: c.brandText, background: c.brandTint, borderColor: c.brandBorder };
const chipMeta: React.CSSProperties = { fontSize: 11.5, fontWeight: 500, color: c.faint };
const card: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", padding: "16px 20px 20px" };
