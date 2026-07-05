"""datasets.rationale 추가 — 해설(참고·읽기전용) 컬럼

Revision ID: 0002_dataset_rationale
Revises: 0001_initial
"""
import sqlalchemy as sa
from alembic import op

revision = "0002_dataset_rationale"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("datasets", sa.Column("rationale", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("datasets", "rationale")
