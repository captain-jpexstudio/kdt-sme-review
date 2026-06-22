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

export async function unlockReviewer(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/unlock`);
}

export function exportUrl(batchId?: string): string {
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost/api/v1";
  return `${base}/admin/export${batchId ? `?batch_id=${encodeURIComponent(batchId)}` : ""}`;
}

