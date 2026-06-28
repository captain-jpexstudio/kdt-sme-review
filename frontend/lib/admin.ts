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

export async function getReviewerSignatures(userId: string): Promise<SignatureInfo[]> {
  const { data } = await api.get<SignatureInfo[]>(`/admin/users/${userId}/signatures`);
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

