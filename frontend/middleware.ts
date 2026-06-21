import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// spec §6 라우팅 가드 — P1에서 /auth/me 기반 분기 구현.
// (미인증→/login, !is_agreed→/agreement, is_batch_submitted→읽기전용)
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/workspace/:path*", "/admin/:path*"],
};
