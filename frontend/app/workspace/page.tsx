"use client";

import axios from "axios";
import { diff_match_patch, DIFF_DELETE, DIFF_INSERT } from "diff-match-patch";
import { ArrowLeft, Ban, Check, ChevronRight, Edit3, FileSignature, Filter, Info, Loader2, Lock, RotateCcw, Save, Search } from "lucide-react";
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
  rejectTask,
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
import { Briefing } from "@/components/Briefing";
import { PaymentForm } from "@/components/PaymentForm";
import { Shell } from "@/components/Shell";
import { c, radius, shadow } from "@/lib/theme";

const REASONS: ErrorReasonName[] = ["문맥_어색", "오타", "사실관계_오류", "전문용어_오용", "중복", "기타", "이상없음"];
const STATUS_LABEL: Record<TaskStatus, string> = { pending: "대기", in_progress: "작업중", completed: "완료" };
const CAP_LABEL: Record<string, string> = { knowledge: "지식", reasoning: "논리", math: "수리" };
const QTYPE_LABEL: Record<string, string> = { mcq: "객관식", short: "단답형", complex: "복합형" };
const MARKERS = "①②③④⑤⑥⑦⑧⑨⑩";
const markerOf = (s: string) => { const t = (s ?? "").trim(); return t && MARKERS.includes(t[0]) ? t[0] : t; };
const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "pending", label: "대기" },
  { key: "in_progress", label: "작업중" },
  { key: "completed", label: "완료" },
];

export default function WorkspacePage() {
  const router = useRouter();
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
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
  const [briefing, setBriefing] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
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
  // 복합형(complex)만 정답 수정 필수. 단답형·객관식은 무수정 통과 허용(정답 비어있지만 않으면).
  const requireEdit = current?.question_type === "complex";
  const canSubmit = !!editStats && !editStats.empty && (requireEdit ? editStats.valid : true);
  const isMcq = !!(current && current.question_type === "mcq" && current.choices && current.choices.length > 0);
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
    if (!current || !canSubmit || submitting || locked) return;
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
  }, [current, canSubmit, filter, loadDetail, locked, query, sort, submitting]);

  const rejectCurrent = useCallback(async () => {
    if (!current || submitting || locked) return;
    const reason = window.prompt("이 문항을 폐기(불가)합니다. 사유를 간략히 입력하세요.");
    if (reason == null) return;
    if (!reason.trim()) { setError("폐기 사유를 입력하세요."); return; }
    if (!window.confirm("폐기하면 이 문항은 제외되고 예비 문항이 대체 배정됩니다. 진행할까요?")) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await rejectTask(current.task_id, { version: current.version, reason: reason.trim() });
      const [sum, refreshed, all] = await Promise.all([
        getTaskSummary(),
        listTasks({ status: filter === "all" ? undefined : filter, q: query.trim() || undefined, sort }),
        listTasks({ sort: "seq" }),
      ]);
      setSummary(sum);
      setItems(refreshed);
      if (!res.replacement_task_id) setError("예비 문항이 모두 소진되어 대체 배정되지 않았습니다.");
      const next = all.find((item) => item.status === "pending" && item.task_id !== current.task_id) ?? all.find((item) => item.task_id !== current.task_id);
      if (next) await loadDetail(next.task_id); else setCurrent(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSubmitting(false);
    }
  }, [current, filter, loadDetail, locked, query, sort, submitting]);

  const submitBatch = useCallback(async () => {
    if (!finalSig || finalBusy || !eligibility.eligible) return;
    setFinalBusy(true);
    setError(null);
    try {
      await batchSubmit({ typed_name: finalSig.typedName, signature_png: finalSig.png });
      setLocked(true);
      setFinalOpen(false);
      setDirty(false);
      setPaymentOpen(true);
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

  // 검수 착수 전 브리핑 — 최초 1회 자동 표시(#4).
  useEffect(() => {
    if (typeof window !== "undefined" && !window.localStorage.getItem("sme_briefing_v1")) setBriefing(true);
  }, []);

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
    <Shell role="reviewer" bare>
      {briefing && <Briefing onDone={() => { window.localStorage.setItem("sme_briefing_v1", "1"); setBriefing(false); }} />}
      {paymentOpen && <PaymentForm onDone={() => setPaymentOpen(false)} />}
      <main style={page} className="ws-page" data-view={mobileView}>
      <aside style={sidebar} className="ws-sidebar">
        <div style={topbar}>
          <div>
            <div style={eyebrow}>검수 워크스페이스</div>
            <h1 style={title}>{summary.completed} / {summary.total}</h1>
          </div>
          <button title="검수 브리핑" onClick={() => setBriefing(true)} style={iconButton}>
            <Info size={17} />
          </button>
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

        <div style={listWrap} className="ws-listwrap">
          {busyList && <div style={mutedLine}><Loader2 size={15} /> 불러오는 중</div>}
          {!busyList && items.length === 0 && <div style={empty}>항목 없음</div>}
          {items.map((item) => (
            <button
              key={item.task_id}
              onClick={() => { loadDetail(item.task_id); setMobileView("detail"); }}
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

      <section style={workspace} className="ws-workspace">
        <button onClick={() => setMobileView("list")} style={backButton} className="ws-backbtn">
          <ArrowLeft size={16} /> 목록으로
        </button>
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
            <div style={detailHead}>
              <div style={eyebrow}>#{current.dataset_id} · {STATUS_LABEL[current.status]} · v{current.version}</div>
              <h2 style={detailTitle}>{current.original_q}</h2>
              <div style={metaRow}>
                {current.source_id && <span style={metaChip}>문항 {current.source_id}</span>}
                {current.source_id?.includes("-P") && <span style={paraChip}>패러프레이징</span>}
                {current.capability_category && <span style={metaChip}>{CAP_LABEL[current.capability_category] ?? current.capability_category}</span>}
                {current.question_type && <span style={metaChip}>{QTYPE_LABEL[current.question_type] ?? current.question_type}</span>}
                {current.difficulty && <span style={metaChip}>난이도 {current.difficulty}</span>}
              </div>
            </div>

            <div style={stack}>
              {/* 질문 */}
              <section style={card}>
                <div style={cardHead}><span style={cardTitle}>질문</span></div>
                <div style={cmp} className="ws-cmp">
                  <div style={cmpCol}>
                    <div style={cmpLabel}>원본</div>
                    <div style={readonlyText}>{current.original_q}</div>
                  </div>
                  <div style={cmpCol}>
                    <div style={cmpLabel}>수정 질문</div>
                    <textarea
                      value={qDraft}
                      onChange={(e) => { setQDraft(e.target.value); markDirty(); }}
                      disabled={locked}
                      style={qArea}
                    />
                  </div>
                </div>
                {current.choices && current.choices.length > 0 && (
                  <div style={choiceWrap}>
                    <div style={cmpLabel}>선지</div>
                    <ul style={choiceList}>
                      {current.choices.map((ch, i) => <li key={i} style={choiceItem}>{ch}</li>)}
                    </ul>
                  </div>
                )}
              </section>

              {/* 해설 (참고·읽기전용) */}
              {current.rationale && (
                <section style={card}>
                  <div style={cardHead}><span style={cardTitle}>해설 <span style={cardHint}>· 참고용(편집 대상 아님)</span></span></div>
                  <div style={{ ...readonlyText, whiteSpace: "pre-wrap" }}>{current.rationale}</div>
                </section>
              )}

              {/* 관련 교리/내용 (참고·읽기전용) */}
              {current.supporting_doctrine && current.supporting_doctrine.length > 0 && (
                <section style={card}>
                  <div style={cardHead}><span style={cardTitle}>관련 교리/내용 <span style={cardHint}>· 참고용</span></span></div>
                  <ul style={doctrineList}>
                    {current.supporting_doctrine.map((d, i) => <li key={i} style={doctrineItem}>{d}</li>)}
                  </ul>
                </section>
              )}

              {/* 정답 검수 (핵심) */}
              <section style={cardHero}>
                <div style={cardHead}>
                  <span style={cardTitle}>정답 검수 <span style={cardHint}>· {requireEdit ? "복합형은 최소 1단어 이상 수정해야 제출됩니다" : isMcq ? "올바른 보기를 선택하세요(변경 선택)" : "확인 후 제출(수정은 선택)"}</span></span>
                  {isMcq ? (
                    <span style={aDraft.trim() !== current.original_a.trim() ? metaWarn : metaOk}>
                      {aDraft.trim() !== current.original_a.trim() ? `변경됨 · ${current.original_a} → ${aDraft}` : "원본과 동일"}
                    </span>
                  ) : editStats && (
                    <span style={editStats.tier === "trivial" ? metaWarn : metaOk}>
                      변경 {editStats.changed}단어 · {Math.round(editStats.ratio * 100)}%{editStats.tier === "trivial" ? " · 변경량 낮음" : ""}
                    </span>
                  )}
                </div>
                {isMcq ? (
                  <div>
                    <div style={cmpLabel}>정답 선택</div>
                    <div style={mcqList}>
                      {current.choices!.map((ch, i) => {
                        const m = markerOf(ch);
                        const sel = m === aDraft.trim();
                        const orig = m === current.original_a.trim();
                        return (
                          <label key={i} style={sel ? mcqOptOn : mcqOpt}>
                            <input type="radio" name="mcq-answer" checked={sel} disabled={locked} onChange={() => { setADraft(m); markDirty(); }} />
                            <span style={{ flex: 1 }}>{ch}</span>
                            {orig && <span style={origTag}>원본</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={cmp} className="ws-cmp">
                      <div style={cmpCol}>
                        <div style={cmpLabel}>원본 정답</div>
                        <div style={readonlyText}>{current.original_a}</div>
                      </div>
                      <div style={cmpCol}>
                        <div style={cmpLabel}>수정 정답</div>
                        <textarea
                          value={aDraft}
                          onChange={(e) => { setADraft(e.target.value); markDirty(); }}
                          disabled={locked}
                          style={aArea}
                        />
                      </div>
                    </div>
                    <div style={diffWrap}>
                      <div style={cmpLabel}>
                        변경 미리보기
                        <span style={diffLegend}><span style={legIns}>추가</span><span style={legDel}>삭제</span></span>
                      </div>
                      <InlineDiff original={current.original_a} edited={aDraft} />
                    </div>
                  </>
                )}
              </section>

              {/* 오류 유형 · 메모 */}
              <section style={card}>
                <div style={cardHead}><span style={cardTitle}>오류 유형 · 메모</span></div>
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
                  placeholder="메모 (선택)"
                  style={noteArea}
                />
              </section>
            </div>

            {/* 하단 고정 액션바 */}
            <div style={actionBar} className="ws-actionbar">
              <div style={actionInfo}>
                <span style={dirty ? saveDirty : saveOk}>{dirty ? "● 저장 대기 중" : savedAt ? `${savedAt} 저장됨` : "동기화됨"}</span>
                <span style={sep}>·</span>
                <span>최종 제출 대상 {eligibility.completed}/{eligibility.total}</span>
              </div>
              <div style={actions} className="ws-actions">
                {eligibility.eligible && !locked && (
                  <button onClick={() => setFinalOpen(true)} style={finalButton}>
                    <FileSignature size={16} /> 최종 제출
                  </button>
                )}
                <button onClick={() => rejectCurrent()} disabled={submitting || locked} style={!submitting && !locked ? { ...secondaryButton, color: c.danger, borderColor: c.dangerBorder } : disabledButton}>
                  <Ban size={16} /> 폐기(불가)
                </button>
                <button onClick={() => saveDraft()} disabled={saving || !dirty || locked} style={(saving || dirty) && !locked ? secondaryButton : disabledButton}>
                  {saving ? <Loader2 size={16} /> : <Save size={16} />} 임시저장
                </button>
                <button onClick={() => submitCurrent()} disabled={submitting || !canSubmit || locked} style={canSubmit && !locked ? primaryButton : disabledButton}>
                  {submitting ? <Loader2 size={16} /> : <Check size={16} />} 제출
                </button>
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
    </Shell>
  );
}

const _dmp = new diff_match_patch();
function InlineDiff({ original, edited }: { original: string; edited: string }) {
  const parts = useMemo(() => {
    const d = _dmp.diff_main(original || "", edited || "");
    _dmp.diff_cleanupSemantic(d);
    return d;
  }, [original, edited]);
  const changed = parts.some(([op]) => op !== 0);
  if (!changed) return <div style={diffEmpty}>아직 변경 사항이 없습니다. 정답을 수정하면 여기에 표시됩니다.</div>;
  return (
    <div style={diffBox}>
      {parts.map(([op, data], i) => {
        if (op === DIFF_INSERT) return <span key={i} style={insTok}>{data}</span>;
        if (op === DIFF_DELETE) return <span key={i} style={delTok}>{data}</span>;
        return <span key={i}>{data}</span>;
      })}
    </div>
  );
}

function statusColor(status: TaskStatus) {
  if (status === "completed") return c.brand;
  if (status === "in_progress") return c.warn;
  return c.faint;
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

const loadingPage: React.CSSProperties = { padding: 40, color: c.sub };
const page: React.CSSProperties = { height: "100vh", display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", background: c.bg, color: c.ink, minHeight: 0 };
const sidebar: React.CSSProperties = { borderRight: `1px solid ${c.line}`, background: c.surface, padding: 18, display: "flex", flexDirection: "column", gap: 13, height: "100vh", overflow: "hidden" };
const topbar: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const eyebrow: React.CSSProperties = { fontSize: 12, color: c.sub, marginBottom: 4, fontWeight: 500 };
const title: React.CSSProperties = { fontSize: 25, lineHeight: 1.1, margin: 0, fontWeight: 700, letterSpacing: "-0.5px" };
const iconButton: React.CSSProperties = { width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", color: c.sub, cursor: "pointer" };
const progressTrack: React.CSSProperties = { height: 8, borderRadius: radius.pill, background: "#e7ebe2", overflow: "hidden" };
const progressBar: React.CSSProperties = { height: "100%", background: `linear-gradient(90deg, ${c.brand}, ${c.brandStrong})`, borderRadius: radius.pill, transition: "width 220ms ease" };
const lockedMini: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, border: `1px solid ${c.warnBorder}`, background: c.warnBg, color: c.warnText, borderRadius: radius.control, padding: "9px 11px", fontSize: 13 };
const searchBox: React.CSSProperties = { height: 38, display: "flex", alignItems: "center", gap: 8, border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", padding: "0 11px" };
const searchInput: React.CSSProperties = { border: 0, outline: 0, background: "transparent", width: "100%", fontSize: 14, color: c.ink };
const chipRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 };
const chip: React.CSSProperties = { height: 32, borderRadius: radius.pill, border: `1px solid ${c.line2}`, background: "#fff", color: c.sub, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const chipActive: React.CSSProperties = { ...chip, borderColor: c.brand, background: c.brandTint, color: c.brandText, fontWeight: 600 };
const sortBox: React.CSSProperties = { height: 36, display: "flex", alignItems: "center", gap: 8, border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", padding: "0 11px" };
const select: React.CSSProperties = { border: 0, outline: 0, background: "transparent", width: "100%", fontSize: 13, color: c.ink };
const listWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, overflowY: "auto", paddingRight: 2, flex: 1, minHeight: 0 };
const itemButton: React.CSSProperties = { minHeight: 48, display: "grid", gridTemplateColumns: "44px 8px minmax(0, 1fr) 16px 16px", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid transparent", borderRadius: radius.control, background: "transparent", cursor: "pointer", textAlign: "left" };
const itemActive: React.CSSProperties = { ...itemButton, borderColor: c.brandBorder, background: c.brandTint };
const seq: React.CSSProperties = { fontVariantNumeric: "tabular-nums", fontSize: 12, color: c.faint };
const statusDot: React.CSSProperties = { width: 8, height: 8, borderRadius: radius.pill };
const itemText: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: c.ink };
const mutedLine: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, color: c.sub, fontSize: 13, padding: 10 };
const empty: React.CSSProperties = { color: c.sub, fontSize: 13, padding: 10 };
const workspace: React.CSSProperties = { padding: 28, minWidth: 0, height: "100vh", overflowY: "auto", background: c.soft };
const backButton: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", marginBottom: 12, border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", color: c.ink, fontSize: 13, fontWeight: 500, cursor: "pointer" };
const errorBox: React.CSSProperties = { border: `1px solid ${c.dangerBorder}`, background: c.dangerBg, color: c.danger, borderRadius: radius.control, padding: "11px 13px", marginBottom: 12, fontSize: 13 };
const lockedBanner: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 11, border: `1px solid ${c.warnBorder}`, background: c.warnBg, color: c.warnText, borderRadius: radius.control, padding: "12px 14px", marginBottom: 14, fontSize: 13 };
const emptyDetail: React.CSSProperties = { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: c.sub };
const detailHead: React.CSSProperties = { marginBottom: 16 };
const detailTitle: React.CSSProperties = { fontSize: 21, lineHeight: 1.45, margin: "3px 0 0", fontWeight: 700, letterSpacing: "-0.4px" };
const stack: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 16, paddingBottom: 84 };
const card: React.CSSProperties = { border: `1px solid ${c.line}`, borderRadius: radius.card, background: c.surface, padding: 20, boxShadow: shadow.card };
const cardHero: React.CSSProperties = { ...card, borderColor: c.brandBorder, boxShadow: "0 1px 2px rgba(20,45,20,.05), 0 8px 26px rgba(63,145,66,.09)" };
const cardHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 };
const cardTitle: React.CSSProperties = { fontSize: 14.5, fontWeight: 700, color: c.ink, letterSpacing: "-0.2px" };
const cardHint: React.CSSProperties = { fontSize: 12, fontWeight: 400, color: c.faint };
const metaOk: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: c.brandText, background: c.brandTint, border: `1px solid ${c.brandBorder}`, borderRadius: 999, padding: "3px 11px" };
const metaWarn: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: c.warnText, background: c.warnBg, border: `1px solid ${c.warnBorder}`, borderRadius: 999, padding: "3px 11px" };
const cmp: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "stretch" };
const cmpCol: React.CSSProperties = { display: "flex", flexDirection: "column", minWidth: 0, height: "100%" };
const cmpLabel: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, fontWeight: 600, color: c.sub, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 7 };
const readonlyText: React.CSSProperties = { flex: 1, minHeight: 0, whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14, color: c.ink, background: c.panel, border: `1px solid ${c.line}`, borderRadius: radius.control, padding: "11px 13px" };
const metaRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 };
const metaChip: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: c.sub, background: c.panel, border: `1px solid ${c.line}`, borderRadius: 999, padding: "3px 10px" };
const paraChip: React.CSSProperties = { ...metaChip, color: c.brandText, background: c.brandTint, borderColor: c.brandBorder };
const choiceWrap: React.CSSProperties = { marginTop: 14 };
const choiceList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6, margin: 0, padding: 0, listStyle: "none" };
const choiceItem: React.CSSProperties = { fontSize: 14, color: c.ink, background: c.panel, border: `1px solid ${c.line}`, borderRadius: radius.control, padding: "9px 12px" };
const doctrineList: React.CSSProperties = { margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 };
const doctrineItem: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.6, color: c.ink };
const mcqList: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const mcqOpt: React.CSSProperties = { display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", border: `1px solid ${c.line2}`, borderRadius: radius.control, background: "#fff", fontSize: 14, color: c.ink, cursor: "pointer" };
const mcqOptOn: React.CSSProperties = { ...mcqOpt, border: `1.5px solid ${c.brand}`, background: c.brandTint, fontWeight: 600 };
const origTag: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: c.sub, background: c.panel, border: `1px solid ${c.line}`, borderRadius: 999, padding: "2px 8px", flexShrink: 0 };
const qArea: React.CSSProperties = { flex: 1, minHeight: 96, resize: "vertical", border: `1px solid ${c.line2}`, borderRadius: radius.control, padding: "11px 13px", font: "inherit", color: c.ink, lineHeight: 1.6, background: "#fff" };
const aArea: React.CSSProperties = { flex: 1, minHeight: 180, resize: "vertical", border: `1px solid ${c.line2}`, borderRadius: radius.control, padding: "11px 13px", font: "inherit", color: c.ink, lineHeight: 1.7, background: "#fff" };
const diffWrap: React.CSSProperties = { marginTop: 16 };
const diffLegend: React.CSSProperties = { display: "inline-flex", gap: 8, textTransform: "none", letterSpacing: 0 };
const legIns: React.CSSProperties = { color: c.brandText, background: c.brandTint, borderRadius: 4, padding: "0 6px", fontWeight: 600 };
const legDel: React.CSSProperties = { color: "#a13b34", background: "#fdecea", borderRadius: 4, padding: "0 6px", fontWeight: 600 };
const diffBox: React.CSSProperties = { whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 14, color: c.ink, background: c.panel, border: `1px solid ${c.line}`, borderRadius: radius.control, padding: "11px 13px" };
const diffEmpty: React.CSSProperties = { fontSize: 13, color: c.faint, background: c.panel, border: `1px dashed ${c.line2}`, borderRadius: radius.control, padding: "12px 13px" };
const insTok: React.CSSProperties = { background: "#d6efce", color: "#1f5b21", borderRadius: 3, padding: "0 1px" };
const delTok: React.CSSProperties = { background: "#fbd9d4", color: "#a13b34", textDecoration: "line-through", borderRadius: 3, padding: "0 1px" };
const actions: React.CSSProperties = { display: "flex", gap: 8, flexShrink: 0 };
const secondaryButton: React.CSSProperties = { height: 38, display: "inline-flex", alignItems: "center", gap: 7, border: `1px solid ${c.line2}`, borderRadius: radius.control, padding: "0 14px", background: "#fff", color: c.ink, fontWeight: 500, cursor: "pointer" };
const primaryButton: React.CSSProperties = { ...secondaryButton, borderColor: "transparent", background: c.brand, color: "#fff", fontWeight: 600 };
const finalButton: React.CSSProperties = { ...secondaryButton, borderColor: "transparent", background: `linear-gradient(135deg, ${c.brand}, ${c.brandStrong})`, color: "#fff", fontWeight: 600 };
const disabledButton: React.CSSProperties = { ...secondaryButton, color: c.faint, background: "#eef0ea", borderColor: c.line, cursor: "not-allowed" };
const actionBar: React.CSSProperties = { position: "sticky", bottom: 0, marginTop: -68, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "rgba(255,255,255,.86)", backdropFilter: "blur(8px)", borderTop: `1px solid ${c.line}`, borderRadius: `${radius.card}px ${radius.card}px 0 0`, boxShadow: "0 -6px 20px rgba(20,45,20,.06)", padding: "12px 18px" };
const actionInfo: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: c.sub };
const saveOk: React.CSSProperties = { color: c.sub };
const saveDirty: React.CSSProperties = { color: c.warn, fontWeight: 600 };
const sep: React.CSSProperties = { color: c.faint };
const reasonGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(112px, 1fr))", gap: 6 };
const reasonOff: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, minHeight: 32, border: `1px solid ${c.line2}`, borderRadius: radius.control, padding: "5px 9px", background: "#fff", fontSize: 13, cursor: "pointer" };
const reasonOn: React.CSSProperties = { ...reasonOff, borderColor: c.brand, background: c.brandTint, color: c.brandText, fontWeight: 600 };
const noteArea: React.CSSProperties = { marginTop: 12, minHeight: 72, resize: "vertical", border: `1px solid ${c.line2}`, borderRadius: radius.control, padding: 11, font: "inherit", color: c.ink, lineHeight: 1.55, background: "#fff" };
const modalBackdrop: React.CSSProperties = { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,35,20,0.4)", padding: 20, zIndex: 30 };
const modal: React.CSSProperties = { width: "min(560px, 100%)", borderRadius: radius.card, background: "#fff", boxShadow: shadow.pop, padding: 24 };
const modalHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" };
const modalTitle: React.CSSProperties = { fontSize: 20, margin: 0, fontWeight: 700, letterSpacing: "-0.3px" };
const modalCopy: React.CSSProperties = { color: c.sub, lineHeight: 1.65, fontSize: 14 };
const modalActions: React.CSSProperties = { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 };
