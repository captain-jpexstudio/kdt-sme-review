"use client";
import { useEffect, useState } from "react";

// 모바일 뷰포트 감지 — 인라인 스타일 분기용. SSR 미스매치 방지 위해 초기값 false,
// 마운트 후 matchMedia로 갱신(모바일 첫 프레임 1회 리플로우 허용).
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [breakpoint]);
  return isMobile;
}
