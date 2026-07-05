"""데이터 모델 — spec-v6 §5.2 그대로.

무결성(§5.2 주석): datasets·audit_logs·signature_assets·증빙 테이블은 append-only.
  → 앱 DB 롤에 UPDATE/DELETE 미부여로 운영(P6). 스키마는 일반 테이블.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)  # admin | reviewer
    is_agreed: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewer_code: Mapped[str | None] = mapped_column(String, unique=True)  # 가명
    session_version: Mapped[int] = mapped_column(Integer, default=0)
    is_batch_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    batch_submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ReviewerProfile(Base):
    __tablename__ = "reviewer_profiles"
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    real_name_enc: Mapped[bytes | None] = mapped_column(LargeBinary)  # 암호화
    branch: Mapped[str | None] = mapped_column(String)  # 공/육/해/해병
    rank: Mapped[str | None] = mapped_column(String)
    specialty: Mapped[str | None] = mapped_column(String)
    degree: Mapped[str | None] = mapped_column(String)
    email: Mapped[str | None] = mapped_column(String)


class PaymentInfo(Base):
    __tablename__ = "payment_info"
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    phone_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    bank_name_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    bank_account_enc: Mapped[bytes | None] = mapped_column(LargeBinary)
    purged: Mapped[bool] = mapped_column(Boolean, default=False)
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Dataset(Base):
    """Immutable. 원본 Q-A."""
    __tablename__ = "datasets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    original_q: Mapped[str] = mapped_column(Text)
    original_a: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str | None] = mapped_column(Text)  # 해설(참고·읽기전용) — 검수 판단용, 편집 대상 아님
    assigned_persona: Mapped[str | None] = mapped_column(String)
    batch_id: Mapped[str | None] = mapped_column(String, index=True)


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (UniqueConstraint("user_id", "dataset_id", name="uq_task_user_dataset"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    dataset_id: Mapped[int] = mapped_column(Integer, ForeignKey("datasets.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="pending", index=True)  # pending|in_progress|completed
    draft_q: Mapped[str | None] = mapped_column(Text)
    draft_a: Mapped[str | None] = mapped_column(Text)
    modified_q: Mapped[str | None] = mapped_column(Text)
    modified_a: Mapped[str | None] = mapped_column(Text)
    error_reasons: Mapped[dict | None] = mapped_column(JSONB)  # [{target,reason}]
    error_note: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=0)  # 낙관적 잠금
    last_accessed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SignatureAsset(Base):
    """Immutable."""
    __tablename__ = "signature_assets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    kind: Mapped[str] = mapped_column(String)  # agreement | batch
    storage_key: Mapped[str] = mapped_column(String)
    sha256: Mapped[str] = mapped_column(String)
    mime: Mapped[str] = mapped_column(String, default="image/png")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgreementRecord(Base):
    __tablename__ = "agreement_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    agreement_version: Mapped[str] = mapped_column(String)
    text_sha256: Mapped[str] = mapped_column(String)
    checkbox_states: Mapped[dict | None] = mapped_column(JSONB)
    typed_name: Mapped[str] = mapped_column(String)
    signature_asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("signature_assets.id"))
    pledge_pdf_key: Mapped[str | None] = mapped_column(String)
    client_ip: Mapped[str | None] = mapped_column(String)
    agreed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BatchSubmission(Base):
    __tablename__ = "batch_submissions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    typed_name: Mapped[str] = mapped_column(String)
    signature_asset_id: Mapped[int] = mapped_column(Integer, ForeignKey("signature_assets.id"))
    final_pdf_key: Mapped[str | None] = mapped_column(String)
    completed_count: Mapped[int] = mapped_column(Integer)
    client_ip: Mapped[str | None] = mapped_column(String)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    """Immutable. append-only."""
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    action_type: Mapped[str] = mapped_column(String)  # LOGIN|AGREE_SIGN|AUTOSAVE|SUBMIT|BATCH_SUBMIT|BATCH_UNLOCK|PII_PURGE
    details: Mapped[dict | None] = mapped_column(JSONB)
    client_ip: Mapped[str | None] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
