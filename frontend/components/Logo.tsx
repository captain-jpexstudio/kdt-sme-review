// 국방 데이터셋 검수앱 엠블럼 — 방패 + 태극(홍청). 애플그린 방패.
export function Logo({ size = 28 }: { size?: number }) {
  const id = "sw-logo";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="Survey Web 로고">
      <defs>
        <linearGradient id={`${id}-g`} x1="6" y1="3" x2="26" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#57ad55" />
          <stop offset="0.55" stopColor="#3f9142" />
          <stop offset="1" stopColor="#2b6f30" />
        </linearGradient>
      </defs>
      {/* 방패 */}
      <path
        d="M16 2.6c.3 0 .6.07.9.19l7.9 3.02c.72.28 1.2.97 1.2 1.74v6.9c0 6.06-3.86 10.86-9.2 13.4a2 2 0 0 1-1.6 0C9.86 25.31 6 20.51 6 14.45v-6.9c0-.77.48-1.46 1.2-1.74l7.9-3.02c.3-.12.6-.19.9-.19Z"
        fill={`url(#${id}-g)`}
      />
      {/* 상단 하이라이트 */}
      <path
        d="M16 2.6c.3 0 .6.07.9.19l7.9 3.02c.72.28 1.2.97 1.2 1.74v1.1c0-.77-.48-1.46-1.2-1.73l-7.9-3.02a2.4 2.4 0 0 0-1.8 0L7.2 6.92C6.48 7.19 6 7.88 6 8.65v-1.1c0-.77.48-1.46 1.2-1.74l7.9-3.02c.3-.12.6-.19.9-.19Z"
        fill="#ffffff"
        fillOpacity="0.28"
      />
      {/* 내부 테두리 */}
      <path
        d="M16 5.1 22.9 7.74c.3.12.5.4.5.72v6c0 4.86-3.05 8.86-7.4 10.96C11.65 23.32 8.6 19.32 8.6 14.46v-6c0-.33.2-.6.5-.72L16 5.1Z"
        stroke="#ffffff"
        strokeOpacity="0.34"
        strokeWidth="1"
      />
      {/* 태극 */}
      <circle cx="16" cy="14.3" r="6.1" fill="#ffffff" />
      <g transform="rotate(-33 16 14.3)">
        <circle cx="16" cy="14.3" r="5" fill="#0047a0" />
        <path
          d="M16 9.3a5 5 0 0 1 0 10 2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 0 0-5Z"
          fill="#cd2e3a"
        />
      </g>
    </svg>
  );
}
