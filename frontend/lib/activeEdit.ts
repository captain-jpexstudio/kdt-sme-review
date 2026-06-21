// Active Edit 클라이언트 미러 — spec §7.5. 서버 verify_active_edit(§13.1)와 동일 규칙.
// 키 입력마다 로컬 즉시 계산(서버 왕복 0). 제출 시 서버가 권위 재검증.

const norm = (t: string) => (t ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
const tok = (t: string) =>
  norm(t)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

function changedWords(o: string, m: string) {
  const a = tok(o),
    b = tok(m),
    n = a.length,
    M = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(M + 1));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= M; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const lcs = dp[n][M];
  return { changed: n - lcs + (M - lcs), ratio: n ? (n - lcs + (M - lcs)) / n : 0, modLen: M };
}

export type Tier = "none" | "trivial" | "ok" | "good";

export function evaluateEdit(
  orig: string,
  draft: string,
  { minWords = 1, suspicious = 0.05, good = 0.3 } = {}
) {
  const { changed, ratio, modLen } = changedWords(orig, draft);
  const identical = norm(orig) === norm(draft),
    empty = modLen === 0,
    valid = !identical && !empty && changed >= minWords;
  let tier: Tier = "none";
  if (valid) tier = ratio >= good ? "good" : ratio < suspicious ? "trivial" : "ok";
  return { valid, changed, ratio, tier, empty };
}
