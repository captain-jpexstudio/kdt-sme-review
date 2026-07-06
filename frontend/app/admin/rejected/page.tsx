"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getRejected, restoreTask, type RejectedItem } from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { c } from "@/lib/theme";
import { S, useAdminGuard } from "../ui";

export default function AdminRejectedPage() {
  const ready = useAdminGuard();
  const [items, setItems] = useState<RejectedItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      setItems(await getRejected());
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (ready) refresh().catch(() => undefined);
  }, [ready, refresh]);

  const doRestore = async (id: string) => {
    if (!window.confirm("이 문항을 복원합니다. 폐기 시 자동 배정된 예비문항이 미착수 상태면 함께 회수됩니다. 진행할까요?")) return;
    setRestoring(id);
    try {
      const r = await restoreTask(id);
      await refresh();
      window.alert(r.replacement_recovered ? "복원 완료 · 대체 예비문항이 회수되었습니다." : "복원 완료 (대체분이 이미 작업 중이라 유지됩니다).");
    } catch {
      window.alert("복원에 실패했습니다.");
    } finally {
      setRestoring(null);
    }
  };

  if (!ready) return <main style={S.loading}>확인 중…</main>;

  return (
    <Shell
      role="admin"
      title="폐기 문항"
      right={<button onClick={() => refresh()} style={S.secondaryButton}><RotateCcw size={16} /> 새로고침</button>}
    >
      <div style={S.panel}>
        <div style={S.panelHeader}>
          <h2 style={S.panelTitle}>폐기(불가) 처리된 문항 · {items.length}건</h2>
        </div>
        {busy && items.length === 0 ? (
          <div style={S.empty}>불러오는 중…</div>
        ) : items.length === 0 ? (
          <div style={S.empty}>폐기된 문항이 없습니다.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>문항번호</th>
                  <th style={th}>검수자</th>
                  <th style={th}>질문</th>
                  <th style={th}>폐기 사유</th>
                  <th style={thR}>복원</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.task_id}>
                    <td style={tdMono}>{it.source_id ?? "-"}</td>
                    <td style={td}>{it.reviewer_code ?? it.reviewer_username}</td>
                    <td style={tdQ}>{it.question_preview}</td>
                    <td style={tdReason}>{it.reason ?? "-"}</td>
                    <td style={tdR}>
                      <button onClick={() => doRestore(it.task_id)} disabled={restoring === it.task_id} style={S.linkButton}>
                        {restoring === it.task_id ? <Loader2 size={13} /> : <RotateCcw size={13} />} 복원
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}

const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${c.line}`, color: c.sub, fontWeight: 600, whiteSpace: "nowrap" };
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "11px 12px", borderBottom: `1px solid ${c.line}`, color: c.ink, verticalAlign: "top" };
const tdMono: React.CSSProperties = { ...td, fontFamily: "monospace", whiteSpace: "nowrap" };
const tdQ: React.CSSProperties = { ...td, maxWidth: 420, color: c.sub };
const tdReason: React.CSSProperties = { ...td, maxWidth: 220, color: c.danger };
const tdR: React.CSSProperties = { ...td, textAlign: "right", whiteSpace: "nowrap" };
