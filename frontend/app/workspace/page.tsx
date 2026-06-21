"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getMe } from "@/lib/auth";

export default function WorkspacePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // spec §6: 미동의 → /agreement 강제 (DoD)
    getMe()
      .then((me) => {
        if (!me.is_agreed) router.replace("/agreement");
        else setReady(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!ready) return <main style={{ padding: 40, fontFamily: "system-ui", color: "#888" }}>확인 중…</main>;

  return (
    <main style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1>검수 워크스페이스</h1>
      <p style={{ color: "#888" }}>P3: 목록↔상세 · Active Edit 실시간 검증 · autosave</p>
    </main>
  );
}
