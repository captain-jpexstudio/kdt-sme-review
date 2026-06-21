import type { ReactNode } from "react";

export const metadata = {
  title: "Survey Web — SME 검수앱",
  description: "Q-A 검수 워크스페이스",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
