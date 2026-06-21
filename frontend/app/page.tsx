import { redirect } from "next/navigation";

export default function Home() {
  // spec §6: 미인증 → /login (가드는 middleware에서, P1)
  redirect("/login");
}
