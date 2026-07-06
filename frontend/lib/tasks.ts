import { api } from "./api";

export type TaskStatus = "pending" | "in_progress" | "completed";
export type TaskFilter = "all" | TaskStatus;
export type TaskSort = "seq" | "status" | "recent";
export type ErrorTarget = "question" | "answer" | "both";
export type ErrorReasonName = "문맥_어색" | "오타" | "사실관계_오류" | "전문용어_오용" | "중복" | "기타" | "이상없음";

export interface ErrorReason {
  target: ErrorTarget;
  reason: ErrorReasonName;
}

export interface TaskSummary {
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
}

export interface TaskListItem {
  task_id: string;
  seq: number;
  dataset_id: number;
  status: TaskStatus;
  q_preview: string;
  edited: boolean;
  suspicious: boolean;
  last_accessed_at: string | null;
  submitted_at: string | null;
  version: number;
}

export interface TaskDetail {
  task_id: string;
  dataset_id: number;
  status: TaskStatus;
  version: number;
  source_id: string | null;
  capability_category: string | null;
  joint_domain: string | null;
  solver: string | null;
  difficulty: string | null;
  question_type: string | null;
  choices: string[] | null;
  supporting_doctrine: string[] | null;
  original_q: string;
  original_a: string;
  rationale: string | null;
  draft_q: string | null;
  draft_a: string | null;
  modified_q: string | null;
  modified_a: string | null;
  error_reasons: ErrorReason[];
  error_note: string | null;
  last_accessed_at: string | null;
  submitted_at: string | null;
}

export interface TaskMutationResponse {
  task_id: string;
  status: TaskStatus;
  version: number;
  suspicious: boolean | null;
  active_edit: Record<string, unknown> | null;
}

export interface BatchEligibility {
  completed: number;
  total: number;
  eligible: boolean;
  locked: boolean;
}

export interface BatchSubmitPayload {
  typed_name: string;
  signature_png: string;
}

export interface BatchSubmitResponse {
  status: "locked";
  completed: number;
  final_pdf_key: string | null;
}

export interface AutosavePayload {
  version: number;
  draft_q: string | null;
  draft_a: string | null;
  error_reasons: ErrorReason[];
  error_note: string | null;
}

export interface SubmitPayload {
  version: number;
  modified_q: string | null;
  modified_a: string;
  error_reasons: ErrorReason[];
  error_note: string | null;
}

export async function getTaskSummary(): Promise<TaskSummary> {
  const { data } = await api.get<TaskSummary>("/tasks/summary");
  return data;
}

export async function listTasks(params: {
  status?: TaskStatus;
  q?: string;
  sort?: TaskSort;
} = {}): Promise<TaskListItem[]> {
  const { data } = await api.get<TaskListItem[]>("/tasks/list", { params });
  return data;
}

export async function resumeTask(): Promise<TaskDetail | null> {
  const { data } = await api.get<TaskDetail | null>("/tasks/resume");
  return data;
}

export async function getTask(taskId: string): Promise<TaskDetail> {
  const { data } = await api.get<TaskDetail>(`/tasks/${taskId}`);
  return data;
}

export async function autosaveTask(taskId: string, payload: AutosavePayload): Promise<TaskMutationResponse> {
  const { data } = await api.patch<TaskMutationResponse>(`/tasks/${taskId}/autosave`, payload);
  return data;
}

export async function submitTask(taskId: string, payload: SubmitPayload): Promise<TaskMutationResponse> {
  const { data } = await api.put<TaskMutationResponse>(`/tasks/${taskId}/submit`, payload);
  return data;
}

export async function getBatchEligibility(): Promise<BatchEligibility> {
  const { data } = await api.get<BatchEligibility>("/tasks/batch/eligibility");
  return data;
}

export async function batchSubmit(payload: BatchSubmitPayload): Promise<BatchSubmitResponse> {
  const { data } = await api.post<BatchSubmitResponse>("/tasks/batch-submit", payload);
  return data;
}
