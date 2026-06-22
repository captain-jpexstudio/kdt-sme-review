"use client";

import axios from "axios";
import { Check, ChevronRight, Edit3, FileSignature, Filter, Loader2, Lock, RotateCcw, Save, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { evaluateEdit } from "@/lib/activeEdit";
import { getMe } from "@/lib/auth";
import { SignaturePad, type SignatureValue } from "@/components/SignaturePad";
import {
  autosaveTask,
  batchSubmit,
  getBatchEligibility,
  getTask,
  getTaskSummary,
  listTasks,
  resumeTask,
  submitTask,
  type ErrorReason,
  type ErrorReasonName,
  type BatchEligibility,
  type TaskDetail,
  type TaskFilter,
  type TaskListItem,
  type TaskStatus,
  type TaskSummary,
} from "@/lib/tasks";
import { useTaskStore } from "@/stores/taskStore";

const REASONS: ErrorReasonName[] = ["문맥_어색", "오타", "사실관계_오류", "전문용어_오용", "중복", "기타", "이상없음"];
const STATUS_LABEL: Record<TaskStatus, string> = { pending: "대기", in_progress: "작업중", completed: "완료" };
const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기" },
  { key: "in_progress", label: "작업중" },
  { key: "completed", label: "완료" },
];

export default function WorkspacePage() {
  const router = useRouter();
  const { currentId, filter, query, sort, set } = useTaskStore();
  const [ready, setReady] = useState(false);
  const [summary, setSummary] = useState<TaskSummary>({ total: 0, completed: 0, in_progress: 0, pending: 0 });
  const [items, setItems] = useState<TaskListItem[]>([]);
  const [current, setCurrent] = useState<TaskDetail | null>(null);
  const [qDraft, setQDraft] = useState("");
  const [aDraft, setADraft] = useState("");
  const [reasons, setReasons] = useState<ErrorReason[]>([]);
  const [note, setNote] = useState("");
  const [busyList, setBusyList] = useState(false);
  const [busyDetail, setBusyDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [eligibility, setEligibility] = useState<BatchEligibility>({ completed: 0, total: 0, eligible: false, locked: false });
  const [finalOpen, setFinalOpen] = useState(false);
  const [finalSig, setFinalSig] = useState<SignatureValue | null>(null);
  const [finalBusy, setFinalBusy] = useState(false);
  const qRef = useRef(qDraft);
  const aRef = useRef(aDraft);
  const reasonsRef = useRef(reasons);
  const noteRef = useRef(note);

  useEffect(() => {
    qRef.current = qDraft;
  }, [qDraft]);
  useEffect(() => {
    aRef.current = aDraft;
  }, [aDraft]);
  useEffect(() => {
    reasonsRef.current = reasons;
  }, [reasons]);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  const loadSummary = useCallback(async () => {
    const [sum, nextEligibility] = await Promise.all([getTaskSummary(), getBatchEligibility()]);
    setSummary(sum);
    setEligibility(nextEligibility);
    setLocked(nextEligibility.locked);
  }, []);

  const loadList = useCallback(async () => {
    setBusyList(true);
    try {
      const next = await listTasks({
        status: filter === "all" ? undefined : filter,
        q: query.trim() || undefined,
        sort,
      });
      setItems(next);
    } finally {
      setBusyList(false);
    }
  }, [filter, query, sort]);

  const loadDetail = useCallback(
    async (taskId: string) => {
      setBusyDetail(true);
      setError(null);
      try {
        const detail = await getTask(taskId);
        setCurrent(detail);
        set({ currentId: detail.task_id });
        setQDraft(detail.modified_q ?? detail.draft_q ?? detail.original_q);
        setADraft(detail.modified_a ?? detail.draft_a ?? detail.original_a);
        setReasons(detail.error_reasons ?? []);
        setNote(detail.error_note ?? "");
        setDirty(false);
        setSavedAt(null);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusyDetail(false);
      }
    },
    [set]
  );

  useEffect(() => {
    getMe()
      .then(async (me) => {
        if (!me.is_agreed) {
          router.replace("/agreement");
          return;
        }
        setLocked(me.is_batch_submitted);
        setReady(true);
        const [sum, list, resumed, nextEligibility] = await Promise.all([
          getTaskSummary(),
          listTasks({ sort }),
          resumeTask(),
          getBatchEligibility(),
        ]);
        setSummary(sum);
        setItems(list);
        setEligibility(nextEligibility);
        setLocked(me.is_batch_submitted || nextEligibility.locked);
        const target = resumed?.task_id ?? currentId ?? list[0]?.task_id;
        if (target) await loadDetail(target);
      })
      .catch(() => router.replace("/login"));
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      loadList().catch((e) => setError(errorText(e)));
    }, 250);
    return () => window.clearTimeout(t);
  }, [ready, loadList]);

  const editStats = useMemo(() => (current ? evaluateEdit(current.original_a, aDraft) : null), [current, aDraft]);
  const progress = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;

  const markDirty = () => {
    setDirty(true);
    setSavedAt(null);
  };

  const saveDraft = useCallback(async () => {
    if (!current || saving || locked) return;
    setSaving(true);
    setError(null);
    const payload = {
      version: current.version,
      draft_q: qRef.current,
      draft_a: aRef.current,
      error_reasons: reasonsRef.current,
      error_note: noteRef.current || null,
    };
    try {
      const res = await autosaveTask(current.task_id, payload);
      setCurrent((c) => (c ? { ...c, status: res.status, version: res.version, draft_q: payload.draft_q, draft_a: payload.draft_a, error_reasons: payload.error_reasons, error_note: payload.error_note } : c));
      const unchanged = qRef.current === payload.draft_q && aRef.current === payload.draft_a && noteRef.current === (payload.error_note ?? "") && JSON.stringify(reasonsRef.current) === JSON.stringify(payload.error_reasons);
      setDirty(!unchanged);
      setSavedAt(timeLabel());
      await Promise.all([loadSummary(), loadList()]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }, [current, loadList, loadSummary, locked, saving]);

  useEffect(() => {
    if (!dirty || !current || saving || submitting || locked) return;
    const t = window.setTimeout(() => {
      saveDraft().catch((e) => setError(errorText(e)));
    }, 1000);
    return () => window.clearTimeout(t);
  }, [current, dirty, locked, saveDraft, saving, submitting]);

  const submitCurrent = useCallback(async () => {
    if (!current || !editStats?.valid || submitting || locked) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await submitTask(current.task_id, {
        version: current.version,
        modified_q: qRef.current,
        modified_a: aRef.current,
        error_reasons: reasonsRef.current,
        error_note: noteRef.current || null,
      });
      setCurrent((c) => (c ? { ...c, status: res.status, version: res.version, modified_q: qRef.current, modified_a: aRef.current } : c));
      setDirty(false);
      setSavedAt(timeLabel());
      const [sum, refreshed] = await Promise.all([
        getTaskSummary(),
        listTasks({ status: filter === "all" ? undefined : filter, q: query.trim() || undefined, sort }),
      ]);
      setSummary(sum);
      setItems(refreshed);
      const all = await listTasks({ sort: "seq" });
      const next = all.find((item) => item.status === "pending" && item.task_id !== current.task_id) ?? all.find((item) => item.task_id !== current.task_id);
      if (next) await loadDetail(next.task_id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSubmitting(false);
    }
  }, [current, editStats?.valid, filter, loadDetail, locked, query, sort, submitting]);

  const submitBatch = useCallback(async () => {
    if (!finalSig || finalBusy || !eligibility.eligible) return;
    setFinalBusy(true);
    setError(null);
    try {
      await batchSubmit({ typed_name: finalSig.typedName, signature_png: finalSig.png });
      setLocked(true);
      setFinalOpen(false);
      setDirty(false);
      await loadSummary();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setFinalBusy(false);
    }
  }, [eligibility.eligible, finalBusy, finalSig, loadSummary]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveDraft().catch((err) => setError(errorText(err)));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        submitCurrent().catch((err) => setError(errorText(err)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveDraft, submitCurrent]);

  const toggleReason = (reason: ErrorReasonName) => {
    if (locked) return;
    setReasons((prev) => {
      const exists = prev.some((r) => r.reason === reason);
      if (exists) return prev.filter((r) => r.reason !== reason);
      if (reason === "이상없음") return [{ target: "both", reason }];
      return [...prev.filter((r) => r.reason !== "이상없음"), { target: "answer", reason }];
    });
    markDirty();
  };

  if (!ready) {
    return <main style={loadingPage}>확인 중…</main>;
  }

  return (
    <main style={page}>
      <aside style={sidebar}>
        <div style={topbar}>
          <div>
            <div style={eyebrow}>검수 워크스페이스</div>
            <h1 style={title}>{summary.completed} / {summary.total}</h1>
          </div>
          <button title="새로고침" onClick={() => Promise.all([loadSummary(), loadList()])} style={iconButton}>
            <RotateCcw size={17} />
          </button>
        </div>

        <div style={progressTrack}><div style={{ ...progressBar, width: `${progress}%` }} /></div>
        {locked && (
          <div style={lockedMini}>
            <Lock size={15} /> 최종 제출 완료
          </div>
        )}

        <label style={searchBox}>
          <Search size={16} color="#6b7280" />
          <input value={query} onChange={(e) => set({ query: e.target.value })} placeholder="검색" style={searchInput} />
        </label>

        <div style={chipRow}>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => set({ filter: f.key })} style={filter === f.key ? chipActive : chip}>
              {f.label}
            </button>
          ))}
        </div>

        <label style={sortBox}>
          <Filter size={15} color="#6b7280" />
          <select value={sort} onChange={(e) => set({ sort: e.target.value as typeof sort })} style={select}>
            <option value="seq">번호순</option>
            <option value="status">상태순</option>
            <option value="recent">최근 작업순</option>
          </select>
        </label>

        <div style={listWrap}>
          {busyList && <div style={mutedLine}><Loader2 size={15} /> 불러오는 중</div>}
          {!busyList && items.length === 0 && <div style={empty}>항목 없음</div>}
          {items.map((item) => (
            <button
              key={item.task_id}
              onClick={() => loadDetail(item.task_id)}
              style={item.task_id === current?.task_id ? itemActive : itemButton}
            >
              <span style={seq}>#{String(item.seq).padStart(3, "0")}</span>
              <span style={{ ...statusDot, background: statusColor(item.status) }} />
              <span style={itemText}>{item.q_preview}</span>
              {item.edited && <Edit3 size={13} color="#64748b" />}
              <ChevronRight size={15} color="#9ca3af" />
            </button>
          ))}
        </div>
      </aside>

      <section style={workspace}>
        {error && <div style={errorBox}>{error}</div>}
        {locked && (
          <div style={lockedBanner}>
            <Lock size={18} />
            <div>
              <b>최종 제출이 완료되어 읽기전용으로 잠겼습니다.</b>
              <div>관리자 해제 전까지 저장과 제출은 차단됩니다.</div>
            </div>
          </div>
        )}
        {!current && !busyDetail && <div style={emptyDetail}>배정된 검수 항목이 없습니다.</div>}
        {busyDetail && <div style={emptyDetail}><Loader2 size={18} /> 불러오는 중</div>}
        {current && !busyDetail && (
          <>
            <header style={detailHeader}>
              <div>
                <div style={eyebrow}>#{current.dataset_id} · {STATUS_LABEL[current.status]} · v{current.version}</div>
                <h2 style={detailTitle}>{current.original_q}</h2>
              </div>
              <div style={actions}>
                {eligibility.eligible && !locked && (
                  <button onClick={() => setFinalOpen(true)} style={primaryButton}>
                    <FileSignature size={16} /> 최종 제출
                  </button>
                )}
                <button onClick={() => saveDraft()} disabled={saving || !dirty || locked} style={saving || dirty && !locked ? secondaryButton : disabledButton}>
                  {saving ? <Loader2 size={16} /> : <Save size={16} />} 임시저장
                </button>
                <button onClick={() => submitCurrent()} disabled={submitting || !editStats?.valid || locked} style={editStats?.valid && !locked ? primaryButton : disabledButton}>
                  {submitting ? <Loader2 size={16} /> : <Check size={16} />} 제출
                </button>
              </div>
            </header>

            <div style={statusLine}>
              <span>{dirty ? "수정됨" : savedAt ? `${savedAt} 저장됨` : "동기화됨"}</span>
              {editStats && <span>변경 {editStats.changed}단어 · {Math.round(editStats.ratio * 100)}%</span>}
              {editStats?.tier === "trivial" && <span style={warnText}>변경량 낮음</span>}
              <span>최종 {eligibility.completed}/{eligibility.total}</span>
            </div>

            <div style={columns}>
              <div style={panel}>
                <div style={panelLabel}>원본 질문</div>
                <div style={readonlyText}>{current.original_q}</div>
                <div style={panelLabel}>원본 정답</div>
                <div style={readonlyText}>{current.original_a}</div>
              </div>
              <div style={editorPanel}>
                <label style={fieldLabel}>수정 질문</label>
                <textarea
                  value={qDraft}
                  onChange={(e) => { setQDraft(e.target.value); markDirty(); }}
                  disabled={locked}
                  style={questionArea}
                />
                <label style={fieldLabel}>수정 정답</label>
                <textarea
                  value={aDraft}
                  onChange={(e) => { setADraft(e.target.value); markDirty(); }}
                  disabled={locked}
                  style={answerArea}
                />
                <div style={reasonGrid}>
                  {REASONS.map((reason) => {
                    const checked = reasons.some((r) => r.reason === reason);
                    return (
                      <label key={reason} style={checked ? reasonOn : reasonOff}>
                        <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggleReason(reason)} />
                        <span>{reason}</span>
                      </label>
                    );
                  })}
                </div>
                <textarea
                  value={note}
                  onChange={(e) => { setNote(e.target.value); markDirty(); }}
                  disabled={locked}
                  placeholder="메모"
                  style={noteArea}
                />
              </div>
            </div>
          </>
        )}
      </section>
      {finalOpen && (
        <div style={modalBackdrop}>
          <div style={modal}>
            <div style={modalHeader}>
              <div>
                <div style={eyebrow}>최종 제출</div>
                <h2 style={modalTitle}>저작권 이관 및 검수 완료 서명</h2>
              </div>
              <button onClick={() => setFinalOpen(false)} style={iconButton}>×</button>
            </div>
            <p style={modalCopy}>
              완료된 {eligibility.completed}개 항목을 최종 제출합니다. 제출 후 전체 워크스페이스는 읽기전용으로 잠기며,
              최종 제출 시각이 정산 기준으로 기록됩니다.
            </p>
            <SignaturePad onChange={setFinalSig} />
            <div style={modalActions}>
              <button onClick={() => setFinalOpen(false)} style={secondaryButton}>취소</button>
              <button onClick={() => submitBatch()} disabled={!finalSig || finalBusy} style={finalSig && !finalBusy ? primaryButton : disabledButton}>
                {finalBusy ? <Loader2 size={16} /> : <FileSignature size={16} />} 서명하고 잠금
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function statusColor(status: TaskStatus) {
  if (status === "completed") return "#0f766e";
  if (status === "in_progress") return "#b45309";
  return "#9ca3af";
}

function timeLabel() {
  return new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function errorText(e: unknown) {
  if (axios.isAxiosError(e)) {
    const detail = e.response?.data?.detail;
    if (detail?.message) return detail.message as string;
    if (detail?.error_code === "VERSION_CONFLICT") return "다른 저장 내용이 있습니다. 새로고침 후 다시 시도하세요.";
    if (detail?.error_code === "ACTIVE_EDIT_REQUIRED") return "정답을 최소 1단어 이상 수정해야 제출할 수 있습니다.";
    if (detail?.error_code === "BATCH_LOCKED") return "최종 제출 완료로 편집이 잠겼습니다.";
    if (detail?.error_code === "INCOMPLETE_TASKS") return "모든 항목을 완료해야 최종 제출할 수 있습니다.";
    if (detail?.error_code === "SIGNATURE_REQUIRED") return "성명과 서명을 모두 입력해 주세요.";
  }
  return "요청 처리에 실패했습니다.";
}

const loadingPage: React.CSSProperties = { padding: 40, fontFamily: "system-ui", color: "#6b7280" };
const page: React.CSSProperties = { minHeight: "100vh", display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", fontFamily: "system-ui", background: "#f7f8f5", color: "#111827" };
const sidebar: React.CSSProperties = { borderRight: "1px solid #d7d9d2", background: "#fbfbf8", padding: 18, display: "flex", flexDirection: "column", gap: 12, minHeight: "100vh" };
const topbar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const eyebrow: React.CSSProperties = { fontSize: 12, color: "#6b7280", marginBottom: 4 };
const title: React.CSSProperties = { fontSize: 24, lineHeight: 1.1, margin: 0 };
const iconButton: React.CSSProperties = { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #cfd3ca", borderRadius: 6, background: "#fff", cursor: "pointer" };
const progressTrack: React.CSSProperties = { height: 7, borderRadius: 999, background: "#e5e7df", overflow: "hidden" };
const progressBar: React.CSSProperties = { height: "100%", background: "#1d6f61", transition: "width 180ms ease" };
const lockedMini: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, border: "1px solid #d8caa6", background: "#fff8e6", color: "#765616", borderRadius: 6, padding: "8px 10px", fontSize: 13 };
const searchBox: React.CSSProperties = { height: 36, display: "flex", alignItems: "center", gap: 8, border: "1px solid #cfd3ca", borderRadius: 6, background: "#fff", padding: "0 9px" };
const searchInput: React.CSSProperties = { border: 0, outline: 0, background: "transparent", width: "100%", fontSize: 14 };
const chipRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 };
const chip: React.CSSProperties = { height: 30, border: "1px solid #cfd3ca", borderRadius: 6, background: "#fff", color: "#4b5563", cursor: "pointer" };
const chipActive: React.CSSProperties = { ...chip, borderColor: "#1d6f61", background: "#e7f2ef", color: "#145348" };
const sortBox: React.CSSProperties = { height: 34, display: "flex", alignItems: "center", gap: 8, border: "1px solid #cfd3ca", borderRadius: 6, background: "#fff", padding: "0 9px" };
const select: React.CSSProperties = { border: 0, outline: 0, background: "transparent", width: "100%", fontSize: 13 };
const listWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, overflowY: "auto", paddingRight: 2 };
const itemButton: React.CSSProperties = { minHeight: 48, display: "grid", gridTemplateColumns: "44px 8px minmax(0, 1fr) 16px 16px", alignItems: "center", gap: 8, padding: "8px 9px", border: "1px solid transparent", borderRadius: 6, background: "transparent", cursor: "pointer", textAlign: "left" };
const itemActive: React.CSSProperties = { ...itemButton, borderColor: "#a9cfc4", background: "#edf6f3" };
const seq: React.CSSProperties = { fontVariantNumeric: "tabular-nums", fontSize: 12, color: "#6b7280" };
const statusDot: React.CSSProperties = { width: 8, height: 8, borderRadius: 999 };
const itemText: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: "#1f2937" };
const mutedLine: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, color: "#6b7280", fontSize: 13, padding: 10 };
const empty: React.CSSProperties = { color: "#6b7280", fontSize: 13, padding: 10 };
const workspace: React.CSSProperties = { padding: 24, minWidth: 0 };
const errorBox: React.CSSProperties = { border: "1px solid #e2a4a4", background: "#fff1f1", color: "#9f2222", borderRadius: 6, padding: "10px 12px", marginBottom: 12, fontSize: 13 };
const lockedBanner: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, border: "1px solid #d8caa6", background: "#fff8e6", color: "#765616", borderRadius: 6, padding: "11px 12px", marginBottom: 12, fontSize: 13 };
const emptyDetail: React.CSSProperties = { height: "calc(100vh - 48px)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "#6b7280" };
const detailHeader: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 10 };
const detailTitle: React.CSSProperties = { fontSize: 22, lineHeight: 1.35, margin: 0, maxWidth: 880 };
const actions: React.CSSProperties = { display: "flex", gap: 8, flexShrink: 0 };
const secondaryButton: React.CSSProperties = { height: 36, display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #cfd3ca", borderRadius: 6, padding: "0 12px", background: "#fff", color: "#374151", cursor: "pointer" };
const primaryButton: React.CSSProperties = { ...secondaryButton, borderColor: "#1d6f61", background: "#1d6f61", color: "#fff" };
const disabledButton: React.CSSProperties = { ...secondaryButton, color: "#9ca3af", background: "#eceee8", cursor: "not-allowed" };
const statusLine: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, minHeight: 26, fontSize: 13, color: "#6b7280", marginBottom: 12 };
const warnText: React.CSSProperties = { color: "#b45309" };
const columns: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(280px, 0.42fr) minmax(420px, 0.58fr)", gap: 16, alignItems: "start" };
const panel: React.CSSProperties = { border: "1px solid #d7d9d2", borderRadius: 6, background: "#fff", padding: 16 };
const editorPanel: React.CSSProperties = { ...panel, display: "flex", flexDirection: "column", gap: 10 };
const panelLabel: React.CSSProperties = { fontSize: 12, color: "#6b7280", margin: "0 0 6px" };
const readonlyText: React.CSSProperties = { whiteSpace: "pre-wrap", lineHeight: 1.65, fontSize: 14, color: "#1f2937", marginBottom: 18 };
const fieldLabel: React.CSSProperties = { fontSize: 12, color: "#4b5563" };
const questionArea: React.CSSProperties = { minHeight: 76, resize: "vertical", border: "1px solid #cfd3ca", borderRadius: 6, padding: 10, font: "inherit", lineHeight: 1.5 };
const answerArea: React.CSSProperties = { minHeight: 220, resize: "vertical", border: "1px solid #cfd3ca", borderRadius: 6, padding: 10, font: "inherit", lineHeight: 1.6 };
const reasonGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))", gap: 6 };
const reasonOff: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, minHeight: 31, border: "1px solid #cfd3ca", borderRadius: 6, padding: "5px 8px", background: "#fff", fontSize: 13 };
const reasonOn: React.CSSProperties = { ...reasonOff, borderColor: "#1d6f61", background: "#e7f2ef", color: "#145348" };
const noteArea: React.CSSProperties = { minHeight: 64, resize: "vertical", border: "1px solid #cfd3ca", borderRadius: 6, padding: 10, font: "inherit", lineHeight: 1.5 };
const modalBackdrop: React.CSSProperties = { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(17,24,39,0.36)", padding: 20, zIndex: 30 };
const modal: React.CSSProperties = { width: "min(560px, 100%)", borderRadius: 8, background: "#fff", boxShadow: "0 24px 80px rgba(0,0,0,0.22)", padding: 20 };
const modalHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" };
const modalTitle: React.CSSProperties = { fontSize: 20, margin: 0 };
const modalCopy: React.CSSProperties = { color: "#4b5563", lineHeight: 1.55, fontSize: 14 };
const modalActions: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 };
