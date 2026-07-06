import uuid
from datetime import datetime

from pydantic import BaseModel


class ReviewerProgress(BaseModel):
    user_id: uuid.UUID
    username: str
    reviewer_code: str | None
    total: int
    completed: int
    in_progress: int
    pending: int
    progress_pct: float
    locked: bool
    batch_submitted_at: datetime | None = None
    last_activity_at: datetime | None = None
    avg_change_ratio: float | None = None
    trivial_count: int = 0


class AdminStats(BaseModel):
    reviewers: int
    total_tasks: int
    completed: int
    in_progress: int
    pending: int
    locked_reviewers: int
    progress_pct: float


class SignatureInfo(BaseModel):
    id: int
    kind: str
    sha256: str
    storage_key: str
    created_at: datetime


class RejectedItem(BaseModel):
    task_id: uuid.UUID
    reviewer_code: str | None
    reviewer_username: str
    source_id: str | None = None
    question_preview: str
    reason: str | None = None
    batch_id: str | None = None
    rejected_at: datetime | None = None

