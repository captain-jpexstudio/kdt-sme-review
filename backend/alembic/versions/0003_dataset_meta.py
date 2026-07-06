"""datasets 벤치마크 메타 컬럼 확장 — 표시·검수판단·main/reserved

Revision ID: 0003_dataset_meta
Revises: 0002_dataset_rationale
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0003_dataset_meta"
down_revision = "0002_dataset_rationale"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("datasets", sa.Column("source_id", sa.String(), nullable=True))
    op.add_column("datasets", sa.Column("choices", JSONB(), nullable=True))
    op.add_column("datasets", sa.Column("supporting_doctrine", JSONB(), nullable=True))
    op.add_column("datasets", sa.Column("capability_category", sa.String(), nullable=True))
    op.add_column("datasets", sa.Column("joint_domain", sa.String(), nullable=True))
    op.add_column("datasets", sa.Column("solver", sa.String(), nullable=True))
    op.add_column("datasets", sa.Column("difficulty", sa.String(), nullable=True))
    op.add_column("datasets", sa.Column("question_type", sa.String(), nullable=True))
    op.add_column("datasets", sa.Column("status", sa.String(), nullable=False, server_default="main"))
    op.create_index("ix_datasets_source_id", "datasets", ["source_id"])
    op.create_index("ix_datasets_status", "datasets", ["status"])


def downgrade() -> None:
    op.drop_index("ix_datasets_status", table_name="datasets")
    op.drop_index("ix_datasets_source_id", table_name="datasets")
    for col in ("status", "question_type", "difficulty", "solver", "joint_domain",
                "capability_category", "supporting_doctrine", "choices", "source_id"):
        op.drop_column("datasets", col)
