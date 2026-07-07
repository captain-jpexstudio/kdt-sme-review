import uuid
from datetime import datetime

from pydantic import BaseModel


class ReviewerProgress(BaseModel):
    user_id: uuid.UUID
    username: str
    reviewer_code: str | None
    total: int  # 현재 작업분(폐기 제외 = 대체 배정 후 300 유지)
    completed: int
    in_progress: int
    pending: int
    rejected: int = 0
    progress_pct: float
    locked: bool
    batch_submitted_at: datetime | None = None
    last_activity_at: datetime | None = None
    avg_change_ratio: float | None = None
    trivial_count: int = 0


class AdminStats(BaseModel):
    reviewers: int
    total_tasks: int  # 현재 작업분(폐기 제외)
    completed: int
    in_progress: int
    pending: int
    rejected: int = 0
    locked_reviewers: int
    progress_pct: float


class SignatureInfo(BaseModel):
    id: int
    kind: str
    sha256: str
    storage_key: str
    created_at: datetime


class AdminTaskItem(BaseModel):
    task_id: uuid.UUID
    user_id: uuid.UUID
    reviewer_code: str | None
    dataset_id: int
    source_id: str | None = None
    question_type: str | None = None
    q_preview: str
    status: str
    edited: bool
    q_changed: bool
    change_ratio: float | None = None
    suspicious: bool
    tagged: bool
    submitted_at: datetime | None = None
    last_accessed_at: datetime | None = None


class AdminTaskList(BaseModel):
    items: list[AdminTaskItem]
    total: int
    page: int
    page_size: int
    # 완료분 정답 변경률 분포(필터 적용·페이지네이션 이전 전체) — 0~10%,…,80~90%,90%+ 10구간
    ratio_histogram: list[int]
    suspicious_total: int


class DiffSide(BaseModel):
    original: str
    modified: str | None = None
    changed_words: int = 0
    change_ratio: float = 0.0
    identical: bool = True


class AdminTaskDiff(BaseModel):
    task_id: uuid.UUID
    reviewer_code: str | None
    status: str
    question_type: str | None = None
    source_id: str | None = None
    question: DiffSide
    answer: DiffSide
    suspicious: bool
    choices: list | None = None
    rationale: str | None = None
    error_reasons: list | None = None
    error_note: str | None = None
    submitted_at: datetime | None = None


class ReservedBatch(BaseModel):
    batch_id: str | None
    total: int      # 업로드된 예비 전체
    assigned: int   # 폐기 대체로 이미 배정됨
    remaining: int  # 잔여(다음 폐기 시 사용)


class ReservedItem(BaseModel):
    dataset_id: int
    source_id: str | None = None
    batch_id: str | None = None
    question_type: str | None = None
    q_preview: str
    assigned_to: str | None = None  # 배정된 검수자 코드(None=잔여)


class ReservedOverview(BaseModel):
    batches: list[ReservedBatch]
    items: list[ReservedItem]


class ReservedUploadResponse(BaseModel):
    batch_id: str
    added: int
    remaining: int


class RejectedItem(BaseModel):
    task_id: uuid.UUID
    reviewer_code: str | None
    reviewer_username: str
    source_id: str | None = None
    question_preview: str
    reason: str | None = None
    batch_id: str | None = None
    rejected_at: datetime | None = None

