// 디자인 토큰 — Asana 참조(다크 좌측 레일 + 순백 콘텐츠 + 얇은 보더 카드) + 국방 애플그린 액센트.
// 레퍼런스: refero.design Asana Dashboard. 설계문서: defense-dataset-platform/_docs/tasks/sme-review-디자인리뉴얼/

export const c = {
  // 브랜드(애플그린 — Asana의 코랄 자리)
  brand: "#3f9142",
  brandStrong: "#2f7a34",
  brandTint: "#eaf6ea",
  brandTintStrong: "#dcefdc",
  brandText: "#256128",
  brandBorder: "#c3e3c3",
  // 다크 네비 레일
  nav: "#1e1f21",
  navText: "#b7b9bb",
  navSection: "#7f8183",
  navActiveBg: "rgba(255,255,255,0.10)",
  navHoverBg: "rgba(255,255,255,0.06)",
  navBorder: "rgba(255,255,255,0.09)",
  // 중립(Asana 화이트)
  bg: "#ffffff",
  soft: "#fbfbfa",
  surface: "#ffffff",
  panel: "#f6f7f8",
  line: "#ededed",
  line2: "#e0e0e1",
  ink: "#1e1f21",
  sub: "#6d6e6f",
  faint: "#9ca0a3",
  // 시맨틱
  info: "#4573d2",
  warn: "#b45309",
  warnText: "#8a5a12",
  warnBg: "#fff8e6",
  warnBorder: "#ecdcb4",
  danger: "#b42318",
  dangerBg: "#fff3f2",
  dangerBorder: "#f1cbc7",
} as const;

export const radius = { card: 10, control: 8, pill: 999 } as const;

export const shadow = {
  card: "0 1px 2px rgba(20,25,30,.04)",
  cardHover: "0 1px 3px rgba(20,25,30,.08), 0 6px 18px rgba(20,25,30,.06)",
  pop: "0 24px 70px rgba(15,20,25,.24)",
  focus: "0 0 0 3px rgba(63,145,66,.20)",
} as const;

// 한글 우선 시스템 폰트 스택(외부 CDN 의존 없음 — 보안격리 배포 대응)
export const font =
  '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif';
