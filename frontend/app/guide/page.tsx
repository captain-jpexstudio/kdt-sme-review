"use client";

import { BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMe } from "@/lib/auth";
import { BRIEFING_PAGES } from "@/components/Briefing";
import { Shell } from "@/components/Shell";
import { c, radius, shadow } from "@/lib/theme";

// 검수 가이드 — 브리핑 팝업과 동일 콘텐츠를 상시 열람 가능한 문서형으로 제공.
export default function GuidePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getMe()
      .then(() => setReady(true))
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ready) return <main style={{ padding: 40, color: c.sub }}>확인 중…</main>;

  return (
    <Shell role="reviewer" title="검수 가이드">
      <p style={lead}>
        <BookOpen size={15} style={{ verticalAlign: -2, marginRight: 6 }} />
        검수 착수 전 브리핑과 동일한 내용입니다. 작업 중 언제든 다시 확인하세요.
      </p>
      {BRIEFING_PAGES.map((p) => (
        <section key={p.title} style={section}>
          <h2 style={sectionTitle}>{p.title}</h2>
          <div style={sectionBody}>{p.body}</div>
        </section>
      ))}
    </Shell>
  );
}

const lead: React.CSSProperties = { margin: "0 0 20px", fontSize: 13.5, color: c.sub };
const section: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.card, background: "#fff", boxShadow: shadow.card, padding: "22px 26px", marginBottom: 14, maxWidth: 820 };
const sectionTitle: React.CSSProperties = { margin: "0 0 14px", fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px", color: c.ink };
const sectionBody: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 14 };
