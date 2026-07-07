"use client";
import { Activity, Ban, BookOpen, ClipboardCheck, Download, History, LayoutDashboard, LogOut, Menu, Upload, Users, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { c, radius, shadow } from "@/lib/theme";

type Item = { key: string; label: string; icon: typeof LayoutDashboard; href?: string; anchor?: string; soon?: boolean };

const NAV: Record<"reviewer" | "admin", Item[]> = {
  reviewer: [
    { key: "workspace", label: "검수 워크스페이스", href: "/workspace", icon: ClipboardCheck },
    { key: "history", label: "내 검수 이력", href: "/history", icon: History },
    { key: "guide", label: "검수 가이드", href: "/guide", icon: BookOpen },
  ],
  admin: [
    { key: "dashboard", label: "대시보드", href: "/admin", icon: LayoutDashboard },
    { key: "datasets", label: "데이터셋 업로드", href: "/admin/datasets", icon: Upload },
    { key: "reviewers", label: "검수자 진행률", href: "/admin/reviewers", icon: Users },
    { key: "tasks", label: "문항 목록", href: "/admin/tasks", icon: ClipboardCheck },
    { key: "rejected", label: "폐기·예비 문항", href: "/admin/rejected", icon: Ban },
    { key: "events", label: "감사 로그 (실시간)", href: "/admin/events", icon: Activity },
    { key: "export", label: "내보내기", href: "/admin/export", icon: Download },
  ],
};

// 공용 앱 셸 — 다크 좌측 네비 레일 + 화이트 콘텐츠(+상단 헤더). Asana 참조.
export function Shell({
  role,
  title,
  right,
  bare,
  children,
}: {
  role: "reviewer" | "admin";
  title?: string;
  right?: ReactNode;
  bare?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* 무시 */
    }
    router.replace("/login");
  };

  const railInner = (
    <>
      <div style={brand}>
        <Logo size={28} />
        <span style={wordmark}>Survey Web</span>
      </div>
      <nav style={navList}>
        <div style={navSection}>{role === "admin" ? "관리" : "검수"}</div>
        {NAV[role].map((it) => {
          const Icon = it.icon;
          const inner = (
            <span style={navLabel}>
              <Icon size={17} /> {it.label}
            </span>
          );
          if (it.soon) {
            return (
              <div key={it.key} style={navItemSoon} title="준비 중">
                {inner}
                <span style={soonChip}>준비중</span>
              </div>
            );
          }
          if (it.anchor) {
            return (
              <button key={it.key} style={navItem} onClick={() => { document.getElementById(it.anchor!)?.scrollIntoView({ behavior: "smooth", block: "start" }); setDrawer(false); }}>
                {inner}
              </button>
            );
          }
          const active = it.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(it.href!);
          return (
            <a key={it.key} href={it.href} style={active ? navItemOn : navItem} onClick={() => setDrawer(false)}>
              {inner}
            </a>
          );
        })}
      </nav>
      <div style={railFoot}>
        <button style={navItem} onClick={logout}>
          <span style={navLabel}><LogOut size={17} /> 로그아웃</span>
        </button>
      </div>
    </>
  );

  return (
    <div style={root} className="shell-root">
      {/* 모바일 상단바 — CSS로 데스크톱에서 숨김 */}
      <header style={mTopbar} className="shell-mtop">
        <button aria-label="메뉴" onClick={() => setDrawer(true)} style={burger}><Menu size={20} /></button>
        <Logo size={24} />
        <span style={wordmarkDark}>Survey Web</span>
      </header>

      {/* 데스크톱 좌측 레일 — CSS로 모바일에서 숨김 */}
      <aside style={rail} className="shell-rail">{railInner}</aside>

      {/* 모바일 드로어 */}
      {drawer && (
        <>
          <div style={backdrop} onClick={() => setDrawer(false)} />
          <aside style={railDrawer}>
            <button aria-label="닫기" onClick={() => setDrawer(false)} style={drawerClose}><X size={18} /></button>
            {railInner}
          </aside>
        </>
      )}

      <div style={main}>
        {title !== undefined && (
          <header style={topbar} className="shell-topbar">
            <div style={crumb}>{title}</div>
            {right && <div style={topRight}>{right}</div>}
          </header>
        )}
        <div style={bare ? bareContent : content} className={bare ? undefined : "shell-content"}>{children}</div>
      </div>
    </div>
  );
}

const root: React.CSSProperties = { minHeight: "100vh", display: "grid", gridTemplateColumns: "236px minmax(0, 1fr)", background: c.bg };
const rail: React.CSSProperties = { background: c.nav, color: c.navText, display: "flex", flexDirection: "column", padding: "16px 12px", gap: 6, position: "sticky", top: 0, height: "100vh" };
const railDrawer: React.CSSProperties = { ...rail, position: "fixed", top: 0, left: 0, height: "100dvh", width: 272, maxWidth: "84vw", zIndex: 50, boxShadow: shadow.pop, overflowY: "auto" };
const backdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(15,20,25,.44)", zIndex: 40 };
const mTopbar: React.CSSProperties = { position: "sticky", top: 0, zIndex: 20, height: 52, flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", background: c.surface, borderBottom: `1px solid ${c.line}` };
const burger: React.CSSProperties = { width: 36, height: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: c.ink, cursor: "pointer", marginLeft: -6 };
const drawerClose: React.CSSProperties = { position: "absolute", top: 12, right: 10, width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color: c.navText, cursor: "pointer", zIndex: 2 };
const brand: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "6px 10px 14px" };
const wordmark: React.CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px", color: "#fff" };
const wordmarkDark: React.CSSProperties = { fontSize: 15, fontWeight: 700, letterSpacing: "-0.3px", color: c.ink };
const navList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3 };
const navSection: React.CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", color: c.navSection, textTransform: "uppercase", padding: "10px 10px 4px" };
const navItem: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 11px", borderRadius: radius.control, color: c.navText, fontSize: 14, fontWeight: 500, textDecoration: "none", cursor: "pointer", background: "transparent", border: "none", textAlign: "left", width: "100%" };
const navLabel: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 11 };
const navItemOn: React.CSSProperties = { ...navItem, background: c.navActiveBg, color: "#fff", fontWeight: 600 };
const navItemSoon: React.CSSProperties = { ...navItem, cursor: "default", color: c.navSection };
const soonChip: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: c.navSection, border: `1px solid ${c.navBorder}`, borderRadius: 999, padding: "1px 7px", flexShrink: 0 };
const railFoot: React.CSSProperties = { marginTop: "auto", display: "flex", flexDirection: "column", gap: 3, paddingTop: 10, borderTop: `1px solid ${c.navBorder}` };

const main: React.CSSProperties = { minWidth: 0, display: "flex", flexDirection: "column", flex: 1 };
const topbar: React.CSSProperties = { height: 58, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "0 26px", borderBottom: `1px solid ${c.line}`, background: c.surface, position: "sticky", top: 0, zIndex: 10 };
const crumb: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: c.ink, letterSpacing: "-0.3px" };
const topRight: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" };
const content: React.CSSProperties = { padding: 28, maxWidth: 1200, width: "100%" };
const bareContent: React.CSSProperties = { flex: 1, minHeight: 0 };
