"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { login } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { useIsMobile } from "@/lib/useIsMobile";
import { c, radius } from "@/lib/theme";

export default function LoginPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await login(username, password);
      // spec §6: !is_agreed → /agreement, else 워크스페이스(admin은 /admin)
      if (me.role === "admin") router.push("/admin");
      else if (!me.is_agreed) router.push("/agreement");
      else router.push("/workspace");
    } catch {
      setError("아이디 또는 비밀번호를 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={isMobile ? shellMobile : shell}>
      {/* 좌: 브랜드 패널 (데스크톱) */}
      {!isMobile && (
        <aside style={brandPane}>
          <div style={brandTop}>
            <span style={markChip}><Logo size={30} /></span>
            <span style={wordmark}>Survey Web</span>
          </div>
          <div>
            <h1 style={hero}>
              국방 데이터셋
              <br />
              검수 워크스페이스
            </h1>
            <p style={heroSub}>
              전문가 검수로 데이터 품질을 끌어올리고, 저작권을 안전하게 귀속합니다.
            </p>
            <ul style={points}>
              <li style={point}><span style={dot} /> 원본 대비 정답 변형 · 오류 태깅</li>
              <li style={point}><span style={dot} /> 임시저장 · 최종 서명 이관</li>
              <li style={point}><span style={dot} /> 관리자 실시간 진행률 모니터링</li>
            </ul>
          </div>
          <div style={brandFoot}>© {"(주) JPEX STUDIO"} · K-Defense Bench</div>
        </aside>
      )}

      {/* 우: 폼 */}
      <section style={isMobile ? formPaneMobile : formPane}>
        <div style={formCard}>
          {isMobile && (
            <div style={mobileBrand}>
              <span style={markChipSm}><Logo size={24} /></span>
              <span style={mobileWordmark}>Survey Web</span>
            </div>
          )}
          <h2 style={title}>로그인</h2>
          <p style={lead}>배정된 검수 계정으로 로그인해 주세요.</p>
          <form onSubmit={onSubmit} style={form}>
            <div>
              <label style={label}>아이디</label>
              <input placeholder="아이디" value={username} onChange={(e) => setUsername(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={label}>비밀번호</label>
              <input placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inp} />
            </div>
            {error && <p style={errorText}>{error}</p>}
            <button disabled={busy} style={busy ? btnBusy : btn}>{busy ? "확인 중…" : "로그인"}</button>
          </form>
        </div>
      </section>
    </main>
  );
}

const shell: React.CSSProperties = { minHeight: "100vh", display: "grid", gridTemplateColumns: "1.05fr 1fr", background: c.surface };
const shellMobile: React.CSSProperties = { minHeight: "100dvh", display: "flex", flexDirection: "column", background: c.bg };
const formPaneMobile: React.CSSProperties = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px", background: c.bg };
const mobileBrand: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, marginBottom: 24 };
const markChipSm: React.CSSProperties = { width: 38, height: 38, borderRadius: 10, background: c.brandTint, display: "inline-flex", alignItems: "center", justifyContent: "center" };
const mobileWordmark: React.CSSProperties = { fontSize: 16, fontWeight: 700, letterSpacing: "-0.3px", color: c.ink };
const brandPane: React.CSSProperties = {
  position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 40,
  padding: "56px 60px", color: "#eef7ec",
  background: `radial-gradient(120% 90% at 15% 10%, #4aa64d 0%, ${c.brand} 42%, ${c.brandStrong} 100%)`,
  overflow: "hidden",
};
const brandTop: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
const markChip: React.CSSProperties = { width: 46, height: 46, borderRadius: 12, background: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(0,0,0,.18)" };
const wordmark: React.CSSProperties = { fontSize: 17, fontWeight: 700, letterSpacing: "-0.3px", color: "#fff" };
const hero: React.CSSProperties = { fontSize: 40, lineHeight: 1.18, fontWeight: 750, letterSpacing: "-1px", margin: "0 0 18px", color: "#fff" };
const heroSub: React.CSSProperties = { fontSize: 15.5, lineHeight: 1.7, margin: "0 0 28px", color: "rgba(255,255,255,.86)", maxWidth: 420 };
const points: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 };
const point: React.CSSProperties = { display: "flex", alignItems: "center", gap: 11, fontSize: 14.5, color: "rgba(255,255,255,.94)" };
const dot: React.CSSProperties = { width: 7, height: 7, borderRadius: 999, background: "#d5f0cf", flexShrink: 0, boxShadow: "0 0 0 4px rgba(255,255,255,.14)" };
const brandFoot: React.CSSProperties = { fontSize: 12.5, color: "rgba(255,255,255,.7)" };

const formPane: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", padding: 40, background: c.bg };
const formCard: React.CSSProperties = { width: "min(400px, 100%)" };
const title: React.CSSProperties = { fontSize: 27, fontWeight: 750, margin: "0 0 6px", letterSpacing: "-0.5px", color: c.ink };
const lead: React.CSSProperties = { fontSize: 14, color: c.sub, margin: "0 0 26px" };
const form: React.CSSProperties = { display: "grid", gap: 16 };
const label: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: c.ink, marginBottom: 6 };
const inp: React.CSSProperties = { width: "100%", padding: "12px 14px", border: `1px solid ${c.line2}`, borderRadius: radius.control, fontSize: 14.5, background: "#fff", color: c.ink };
const errorText: React.CSSProperties = { color: c.danger, fontSize: 13, margin: 0 };
const btn: React.CSSProperties = { marginTop: 4, padding: "13px 14px", border: "1px solid transparent", borderRadius: radius.control, background: c.brand, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" };
const btnBusy: React.CSSProperties = { ...btn, background: c.brandStrong, cursor: "wait" };
