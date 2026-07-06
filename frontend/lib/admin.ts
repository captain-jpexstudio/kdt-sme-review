import { api } from "./api";

export interface AdminStats {
  reviewers: number;
  total_tasks: number;
  completed: number;
  in_progress: number;
  pending: number;
  locked_reviewers: number;
  progress_pct: number;
}

export interface ReviewerProgress {
  user_id: string;
  username: string;
  reviewer_code: string | null;
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
  progress_pct: number;
  locked: boolean;
  batch_submitted_at: string | null;
  last_activity_at: string | null;
  avg_change_ratio: number | null;
  trivial_count: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const { data } = await api.get<AdminStats>("/admin/stats");
  return data;
}

export async function getReviewers(): Promise<ReviewerProgress[]> {
  const { data } = await api.get<ReviewerProgress[]>("/admin/reviewers");
  return data;
}

export interface DatasetUploadResult {
  batch_id: string;
  datasets: number;
  tasks: number;
  reviewers: number;
  per_reviewer: number;
}

export async function uploadDataset(
  file: File,
  opts: { batchId?: string; perReviewer?: number } = {},
): Promise<DatasetUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const params: Record<string, string | number> = {};
  if (opts.batchId) params.batch_id = opts.batchId;
  if (opts.perReviewer) params.per_reviewer = opts.perReviewer;
  const { data } = await api.post<DatasetUploadResult>("/admin/datasets/upload", form, { params });
  return data;
}

export interface SignatureInfo {
  id: number;
  kind: string; // agreement | batch
  sha256: string;
  storage_key: string;
  created_at: string;
}

export async function unlockReviewer(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/unlock`);
}

export interface RejectedItem {
  task_id: string;
  reviewer_code: string | null;
  reviewer_username: string;
  source_id: string | null;
  question_preview: string;
  reason: string | null;
  batch_id: string | null;
  rejected_at: string | null;
}

export async function getRejected(batchId?: string): Promise<RejectedItem[]> {
  const { data } = await api.get<RejectedItem[]>("/admin/rejected", { params: batchId ? { batch_id: batchId } : {} });
  return data;
}

export async function restoreTask(taskId: string): Promise<{ ok: boolean; replacement_recovered: boolean }> {
  const { data } = await api.post<{ ok: boolean; replacement_recovered: boolean }>(`/admin/tasks/${taskId}/restore`);
  return data;
}

export async function getReviewerSignatures(userId: string): Promise<SignatureInfo[]> {
  const { data } = await api.get<SignatureInfo[]>(`/admin/users/${userId}/signatures`);
  return data;
}

export interface AdminTaskItem {
  task_id: string;
  user_id: string;
  reviewer_code: string | null;
  dataset_id: number;
  source_id: string | null;
  question_type: string | null;
  q_preview: string;
  status: string;
  edited: boolean;
  q_changed: boolean;
  change_ratio: number | null;
  suspicious: boolean;
  tagged: boolean;
  submitted_at: string | null;
  last_accessed_at: string | null;
}

export interface AdminTaskList {
  items: AdminTaskItem[];
  total: number;
  page: number;
  page_size: number;
  ratio_histogram: number[];
  suspicious_total: number;
}

export interface AdminTaskFilters {
  userId?: string;
  status?: string;
  suspicious?: boolean;
  tagged?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function getAdminTasks(f: AdminTaskFilters = {}): Promise<AdminTaskList> {
  const params: Record<string, string | number | boolean> = {};
  if (f.userId) params.user_id = f.userId;
  if (f.status) params.status = f.status;
  if (f.suspicious !== undefined) params.suspicious = f.suspicious;
  if (f.tagged !== undefined) params.tagged = f.tagged;
  if (f.q) params.q = f.q;
  if (f.page) params.page = f.page;
  if (f.pageSize) params.page_size = f.pageSize;
  const { data } = await api.get<AdminTaskList>("/admin/tasks", { params });
  return data;
}

export interface DiffSide {
  original: string;
  modified: string | null;
  changed_words: number;
  change_ratio: number;
  identical: boolean;
}

export interface AdminTaskDiff {
  task_id: string;
  reviewer_code: string | null;
  status: string;
  question_type: string | null;
  source_id: string | null;
  question: DiffSide;
  answer: DiffSide;
  suspicious: boolean;
  choices: string[] | null;
  rationale: string | null;
  error_reasons: { target?: string; reason?: string }[] | null;
  error_note: string | null;
  submitted_at: string | null;
}

export async function getTaskDiff(taskId: string): Promise<AdminTaskDiff> {
  const { data } = await api.get<AdminTaskDiff>(`/admin/tasks/${taskId}/diff`);
  return data;
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost/api/v1";
}

export function exportUrl(batchId?: string): string {
  return `${apiBase()}/admin/export${batchId ? `?batch_id=${encodeURIComponent(batchId)}` : ""}`;
}

export function agreementPdfUrl(userId: string): string {
  return `${apiBase()}/admin/users/${userId}/agreement.pdf`;
}

export function finalPdfUrl(userId: string): string {
  return `${apiBase()}/admin/users/${userId}/final.pdf`;
}

export function signatureImageUrl(assetId: number): string {
  return `${apiBase()}/admin/signatures/${assetId}/image`;
}

