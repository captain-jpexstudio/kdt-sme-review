"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
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
    <main style={{ maxWidth: 360, margin: "80px auto", fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20 }}>Survey Web — 로그인</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <input placeholder="아이디" value={username} onChange={(e) => setUsername(e.target.value)} style={inp} />
        <input placeholder="비밀번호" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inp} />
        {error && <p style={{ color: "#a32d2d", fontSize: 13 }}>{error}</p>}
        <button disabled={busy} style={btn}>{busy ? "확인 중…" : "로그인"}</button>
      </form>
    </main>
  );
}

const inp: React.CSSProperties = { padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6 };
const btn: React.CSSProperties = { padding: "9px 10px", border: "1px solid #185fa5", borderRadius: 6, background: "#e6f1fb", color: "#185fa5", cursor: "pointer" };
