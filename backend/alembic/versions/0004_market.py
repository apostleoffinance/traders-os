"""Market candles, analyses, annotations, trade source.

Revision ID: 0004_market
Revises: 0003_checklist_templates
Create Date: 2026-08-21
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_market"
down_revision: Union[str, None] = "0003_checklist_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "market_candles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("timeframe", sa.String(length=8), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open", sa.Numeric(18, 6), nullable=False),
        sa.Column("high", sa.Numeric(18, 6), nullable=False),
        sa.Column("low", sa.Numeric(18, 6), nullable=False),
        sa.Column("close", sa.Numeric(18, 6), nullable=False),
        sa.Column("volume", sa.Numeric(24, 8), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "symbol", "timeframe", "timestamp", name="uq_market_candle"),
    )
    op.create_index(op.f("ix_market_candles_provider"), "market_candles", ["provider"])
    op.create_index(op.f("ix_market_candles_symbol"), "market_candles", ["symbol"])
    op.create_index(op.f("ix_market_candles_timeframe"), "market_candles", ["timeframe"])
    op.create_index(op.f("ix_market_candles_timestamp"), "market_candles", ["timestamp"])
    op.create_index("ix_market_candles_symbol_tf_ts", "market_candles", ["symbol", "timeframe", "timestamp"])

    op.create_table(
        "market_analyses",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("timeframe", sa.String(length=8), nullable=False),
        sa.Column("session", sa.String(length=32), nullable=False),
        sa.Column("setup_id", sa.Uuid(), nullable=True),
        sa.Column("direction", sa.String(length=8), nullable=True),
        sa.Column("analysis_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("entry", sa.Numeric(18, 6), nullable=True),
        sa.Column("stop_loss", sa.Numeric(18, 6), nullable=True),
        sa.Column("take_profit", sa.Numeric(18, 6), nullable=True),
        sa.Column("planned_risk", sa.Numeric(18, 2), nullable=True),
        sa.Column("planned_rr", sa.Numeric(12, 4), nullable=True),
        sa.Column("position_size", sa.Numeric(18, 4), nullable=True),
        sa.Column("quote_to_account_rate", sa.Numeric(18, 8), nullable=True),
        sa.Column("thesis", sa.Text(), nullable=True),
        sa.Column("market_context", sa.Text(), nullable=True),
        sa.Column("liquidity_notes", sa.Text(), nullable=True),
        sa.Column("structure_notes", sa.Text(), nullable=True),
        sa.Column("rejection_notes", sa.Text(), nullable=True),
        sa.Column("psychology_state", sa.String(length=32), nullable=True),
        sa.Column("checklist_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("chart_range", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["setup_id"], ["setups.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_market_analyses_user_id"), "market_analyses", ["user_id"])
    op.create_index(op.f("ix_market_analyses_account_id"), "market_analyses", ["account_id"])
    op.create_index(op.f("ix_market_analyses_symbol"), "market_analyses", ["symbol"])
    op.create_index(op.f("ix_market_analyses_status"), "market_analyses", ["status"])

    op.create_table(
        "chart_annotations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("analysis_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=True),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("timeframe", sa.String(length=8), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("timestamp_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("price", sa.Numeric(18, 6), nullable=True),
        sa.Column("price_end", sa.Numeric(18, 6), nullable=True),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("extra", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["analysis_id"], ["market_analyses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chart_annotations_user_id"), "chart_annotations", ["user_id"])
    op.create_index(op.f("ix_chart_annotations_analysis_id"), "chart_annotations", ["analysis_id"])

    op.add_column("trades", sa.Column("source", sa.String(length=32), nullable=False, server_default="manual"))
    op.add_column("trades", sa.Column("source_analysis_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_trades_source_analysis_id"), "trades", ["source_analysis_id"])
    op.create_foreign_key(
        "fk_trades_source_analysis_id",
        "trades",
        "market_analyses",
        ["source_analysis_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.alter_column("trades", "source", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_trades_source_analysis_id", "trades", type_="foreignkey")
    op.drop_index(op.f("ix_trades_source_analysis_id"), table_name="trades")
    op.drop_column("trades", "source_analysis_id")
    op.drop_column("trades", "source")
    op.drop_table("chart_annotations")
    op.drop_table("market_analyses")
    op.drop_table("market_candles")
