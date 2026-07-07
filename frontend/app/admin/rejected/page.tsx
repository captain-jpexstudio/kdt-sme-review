"use client";

import { AlertTriangle, Archive, Loader2, RotateCcw, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getRejected,
  getReserved,
  restoreTask,
  uploadReserved,
  type RejectedItem,
  type ReservedOverview,
} from "@/lib/admin";
import { Shell } from "@/components/Shell";
import { c, radius } from "@/lib/theme";
import { S, useAdminGuard } from "../ui";

export default function AdminRejectedPage() {
  const ready = useAdminGuard();
  const [items, setItems] = useState<RejectedItem[]>([]);
  const [reserved, setReserved] = useState<ReservedOverview | null>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [rej, res] = await Promise.all([getRejected(), getReserved()]);
      setItems(rej);
      setReserved(res);
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
      {reserved && <ReservedPanel reserved={reserved} onUploaded={refresh} />}

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

// 예비 풀 현황 — 폐기 시 자동 대체 배정에 쓰이는 재고. 잔여 확인 + xlsx 보충 업로드.
function ReservedPanel({ reserved, onUploaded }: { reserved: ReservedOverview; onUploaded: () => Promise<void> }) {
  const [showItems, setShowItems] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetBatch = useRef<string | null>(null);

  const pickFile = (batchId: string) => {
    targetBatch.current = batchId;
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const batchId = targetBatch.current;
    if (!file || !batchId) return;
    setUploading(batchId);
    try {
      const r = await uploadReserved(batchId, file);
      await onUploaded();
      window.alert(`예비 ${r.added}건 추가 완료 · 현재 잔여 ${r.remaining}건`);
    } catch {
      window.alert("예비 추가에 실패했습니다. 파일(question/answer 컬럼)을 확인하세요.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div style={{ ...S.panel, marginBottom: 16 }}>
      <div style={S.panelHeader}>
        <h2 style={S.panelTitle}><Archive size={15} style={{ verticalAlign: -2 }} /> 예비(Reserved) 문항 풀</h2>
        <button onClick={() => setShowItems((v) => !v)} style={S.linkButton}>{showItems ? "목록 접기" : "목록 보기"}</button>
      </div>
      <p style={reservedLead}>
        문항이 폐기되면 같은 배치의 예비 풀에서 미배정 문항 1건이 해당 검수자에게 자동 배정됩니다. 잔여가 0이면
        폐기 시 대체 없이 작업량만 줄어드니, 아래에서 xlsx로 보충하세요.
      </p>
      <input ref={fileRef} type="file" accept=".xlsx,.xlsm" onChange={onFile} style={{ display: "none" }} />
      {reserved.batches.length === 0 && <div style={S.empty}>업로드된 예비 문항이 없습니다. 데이터셋 업로드 시 status=reserved 행이 예비 풀로 들어갑니다.</div>}
      <div style={batchGrid}>
        {reserved.batches.map((b) => (
          <div key={b.batch_id ?? "none"} style={b.remaining === 0 ? batchCardWarn : batchCard}>
            <div style={batchTop}>
              <span style={batchName}>{b.batch_id ?? "(배치 없음)"}</span>
              {b.remaining === 0 && <span style={warnPill}><AlertTriangle size={11} /> 소진</span>}
            </div>
            <div style={batchNums}>
              <span>잔여 <b style={{ fontSize: 20, color: b.remaining === 0 ? c.danger : c.brandText }}>{b.remaining}</b></span>
              <span style={{ color: c.sub }}>사용 {b.assigned} · 전체 {b.total}</span>
            </div>
            <button onClick={() => pickFile(b.batch_id ?? "")} disabled={uploading === b.batch_id} style={S.linkButton}>
              {uploading === b.batch_id ? <Loader2 size={13} /> : <Upload size={13} />} 예비 추가 (xlsx)
            </button>
          </div>
        ))}
      </div>
      {showItems && (
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>문항번호</th>
                <th style={th}>유형</th>
                <th style={th}>질문</th>
                <th style={th}>상태</th>
              </tr>
            </thead>
            <tbody>
              {reserved.items.map((it) => (
                <tr key={it.dataset_id}>
                  <td style={tdMono}>{it.source_id ?? `#${it.dataset_id}`}</td>
                  <td style={td}>{it.question_type ?? "-"}</td>
                  <td style={tdQ}>{it.q_preview}</td>
                  <td style={td}>
                    {it.assigned_to
                      ? <span style={{ color: c.sub }}>{it.assigned_to}에게 배정됨</span>
                      : <span style={{ color: c.brandText, fontWeight: 600 }}>잔여</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const reservedLead: React.CSSProperties = { margin: "0 0 14px", fontSize: 13, color: c.sub, lineHeight: 1.7 };
const batchGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 };
const batchCard: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.control, background: c.soft, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" };
const batchCardWarn: React.CSSProperties = { ...batchCard, background: c.dangerBg, borderColor: c.dangerBorder };
const batchTop: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" };
const batchName: React.CSSProperties = { fontFamily: "monospace", fontSize: 12.5, fontWeight: 700, color: c.ink };
const warnPill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: c.danger, background: "#fff", border: `1px solid ${c.dangerBorder}`, borderRadius: 999, padding: "1px 8px" };
const batchNums: React.CSSProperties = { display: "flex", alignItems: "baseline", gap: 10, fontSize: 13 };

const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 12px", borderBottom: `1px solid ${c.line}`, color: c.sub, fontWeight: 600, whiteSpace: "nowrap" };
const thR: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "11px 12px", borderBottom: `1px solid ${c.line}`, color: c.ink, verticalAlign: "top" };
const tdMono: React.CSSProperties = { ...td, fontFamily: "monospace", whiteSpace: "nowrap" };
const tdQ: React.CSSProperties = { ...td, maxWidth: 420, color: c.sub };
const tdReason: React.CSSProperties = { ...td, maxWidth: 220, color: c.danger };
const tdR: React.CSSProperties = { ...td, textAlign: "right", whiteSpace: "nowrap" };
