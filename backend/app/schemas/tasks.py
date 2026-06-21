import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


TaskStatus = Literal["pending", "in_progress", "completed"]
TaskSort = Literal["seq", "status", "recent"]


class ErrorReason(BaseModel):
    target: Literal["question", "answer", "both"]
    reason: Literal["문맥_어색", "오타", "사실관계_오류", "전문용어_오용", "중복", "기타", "이상없음"]


class TaskSummary(BaseModel):
    total: int
    completed: int
    in_progress: int
    pending: int


class TaskListItem(BaseModel):
    task_id: uuid.UUID
    seq: int
    dataset_id: int
    status: TaskStatus
    q_preview: str
    edited: bool
    suspicious: bool
    last_accessed_at: datetime | None = None
    submitted_at: datetime | None = None
    version: int


class TaskDetail(BaseModel):
    task_id: uuid.UUID
    dataset_id: int
    status: TaskStatus
    version: int
    original_q: str
    original_a: str
    draft_q: str | None = None
    draft_a: str | None = None
    modified_q: str | None = None
    modified_a: str | None = None
    error_reasons: list[ErrorReason] = Field(default_factory=list)
    error_note: str | None = None
    last_accessed_at: datetime | None = None
    submitted_at: datetime | None = None


class AutosaveRequest(BaseModel):
    version: int
    draft_q: str | None = None
    draft_a: str | None = None
    error_reasons: list[ErrorReason] = Field(default_factory=list)
    error_note: str | None = None


class SubmitRequest(BaseModel):
    version: int
    modified_q: str | None = None
    modified_a: str
    error_reasons: list[ErrorReason] = Field(default_factory=list)
    error_note: str | None = None


class TaskMutationResponse(BaseModel):
    task_id: uuid.UUID
    status: TaskStatus
    version: int
    suspicious: bool | None = None
    active_edit: dict[str, Any] | None = None


class DatasetUploadResponse(BaseModel):
    batch_id: str
    datasets: int
    tasks: int
    reviewers: int
    per_reviewer: int
