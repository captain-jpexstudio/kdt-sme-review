"""initial schema (spec-v6 §5.2)

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-21
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("is_agreed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reviewer_code", sa.String(), unique=True),
        sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_batch_submitted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("batch_submitted_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "reviewer_profiles",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("real_name_enc", sa.LargeBinary()),
        sa.Column("branch", sa.String()),
        sa.Column("rank", sa.String()),
        sa.Column("specialty", sa.String()),
        sa.Column("degree", sa.String()),
        sa.Column("email", sa.String()),
    )

    op.create_table(
        "payment_info",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("phone_enc", sa.LargeBinary()),
        sa.Column("bank_name_enc", sa.LargeBinary()),
        sa.Column("bank_account_enc", sa.LargeBinary()),
        sa.Column("purged", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("purged_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "datasets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("original_q", sa.Text(), nullable=False),
        sa.Column("original_a", sa.Text(), nullable=False),
        sa.Column("assigned_persona", sa.String()),
        sa.Column("batch_id", sa.String()),
    )
    op.create_index("ix_datasets_batch_id", "datasets", ["batch_id"])

    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("dataset_id", sa.Integer(), sa.ForeignKey("datasets.id"), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("draft_q", sa.Text()),
        sa.Column("draft_a", sa.Text()),
        sa.Column("modified_q", sa.Text()),
        sa.Column("modified_a", sa.Text()),
        sa.Column("error_reasons", JSONB()),
        sa.Column("error_note", sa.Text()),
        sa.Column("version", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_accessed_at", sa.DateTime(timezone=True)),
        sa.Column("submitted_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("user_id", "dataset_id", name="uq_task_user_dataset"),
    )
    op.create_index("ix_tasks_user_id", "tasks", ["user_id"])
    op.create_index("ix_tasks_dataset_id", "tasks", ["dataset_id"])
    op.create_index("ix_tasks_status", "tasks", ["status"])

    op.create_table(
        "signature_assets",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("storage_key", sa.String(), nullable=False),
        sa.Column("sha256", sa.String(), nullable=False),
        sa.Column("mime", sa.String(), nullable=False, server_default="image/png"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "agreement_records",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("agreement_version", sa.String(), nullable=False),
        sa.Column("text_sha256", sa.String(), nullable=False),
        sa.Column("checkbox_states", JSONB()),
        sa.Column("typed_name", sa.String(), nullable=False),
        sa.Column("signature_asset_id", sa.Integer(), sa.ForeignKey("signature_assets.id"), nullable=False),
        sa.Column("pledge_pdf_key", sa.String()),
        sa.Column("client_ip", sa.String()),
        sa.Column("agreed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "batch_submissions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("typed_name", sa.String(), nullable=False),
        sa.Column("signature_asset_id", sa.Integer(), sa.ForeignKey("signature_assets.id"), nullable=False),
        sa.Column("final_pdf_key", sa.String()),
        sa.Column("completed_count", sa.Integer(), nullable=False),
        sa.Column("client_ip", sa.String()),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("action_type", sa.String(), nullable=False),
        sa.Column("details", JSONB()),
        sa.Column("client_ip", sa.String()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    for t in [
        "audit_logs", "batch_submissions", "agreement_records", "signature_assets",
        "tasks", "datasets", "payment_info", "reviewer_profiles", "users",
    ]:
        op.drop_table(t)
