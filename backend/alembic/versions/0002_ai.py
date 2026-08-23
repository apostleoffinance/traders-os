"""ai analyses and memories

Revision ID: 0002_ai
Revises: 0001_initial
Create Date: 2026-08-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_ai"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_analyses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("trade_id", sa.Uuid(), nullable=True),
        sa.Column("analysis_type", sa.String(length=64), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("model", sa.String(length=120), nullable=False),
        sa.Column("prompt_version", sa.String(length=32), nullable=False),
        sa.Column("context_hash", sa.String(length=64), nullable=False),
        sa.Column("response_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_analyses_user_id"), "ai_analyses", ["user_id"])
    op.create_index(op.f("ix_ai_analyses_account_id"), "ai_analyses", ["account_id"])
    op.create_index(op.f("ix_ai_analyses_trade_id"), "ai_analyses", ["trade_id"])
    op.create_index(op.f("ix_ai_analyses_analysis_type"), "ai_analyses", ["analysis_type"])
    op.create_index(op.f("ix_ai_analyses_context_hash"), "ai_analyses", ["context_hash"])
    op.create_index(op.f("ix_ai_analyses_created_at"), "ai_analyses", ["created_at"])

    op.create_table(
        "ai_memories",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "account_id", "key", name="uq_ai_memory_key"),
    )
    op.create_index(op.f("ix_ai_memories_user_id"), "ai_memories", ["user_id"])
    op.create_index(op.f("ix_ai_memories_account_id"), "ai_memories", ["account_id"])


def downgrade() -> None:
    op.drop_table("ai_memories")
    op.drop_table("ai_analyses")
