import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// spec §6 라우팅 가드(1차) — 보호 경로에 access 쿠키 없으면 /login.
// is_agreed/잠금 등 상태 기반 정밀 분기는 각 페이지에서 /auth/me로 수행(P1: workspace).
export function middleware(req: NextRequest) {
  const hasAccess = req.cookies.has("access_token");
  if (!hasAccess) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/workspace/:path*", "/admin/:path*", "/history", "/history/:path*"],
};
