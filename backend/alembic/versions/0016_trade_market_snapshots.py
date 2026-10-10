"""Versioned market-context snapshots linked to canonical trades.

Revision ID: 0016_trade_market_snapshots
Revises: 0015_broker_candles
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0016_trade_market_snapshots"
down_revision: Union[str, None] = "0015_broker_candles"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "trade_market_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("trade_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("timeframe", sa.String(length=8), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("candle_count", sa.Integer(), nullable=False),
        sa.Column("gap_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("largest_gap_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("coverage_status", sa.String(length=16), nullable=False),
        sa.Column("fingerprint", sa.String(length=64), nullable=False),
        sa.Column("snapshot_json", sa.JSON().with_variant(postgresql.JSONB(), "postgresql"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trade_id", "timeframe", "fingerprint", name="uq_trade_market_snapshot_fingerprint"),
    )
    op.create_index("ix_trade_market_snapshots_user_id", "trade_market_snapshots", ["user_id"])
    op.create_index("ix_trade_market_snapshots_account_id", "trade_market_snapshots", ["account_id"])
    op.create_index("ix_trade_market_snapshots_trade_id", "trade_market_snapshots", ["trade_id"])
    op.create_index(
        "ix_trade_market_snapshots_trade_created",
        "trade_market_snapshots",
        ["trade_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_trade_market_snapshots_trade_created", table_name="trade_market_snapshots")
    op.drop_index("ix_trade_market_snapshots_trade_id", table_name="trade_market_snapshots")
    op.drop_index("ix_trade_market_snapshots_account_id", table_name="trade_market_snapshots")
    op.drop_index("ix_trade_market_snapshots_user_id", table_name="trade_market_snapshots")
    op.drop_table("trade_market_snapshots")
