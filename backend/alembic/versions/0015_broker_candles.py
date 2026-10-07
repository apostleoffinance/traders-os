"""Broker-scoped OHLC bars pushed by the MT5 connector.

Revision ID: 0015_broker_candles
Revises: 0014_mt5_evidence_utc
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_broker_candles"
down_revision: Union[str, None] = "0014_mt5_evidence_utc"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "broker_candles",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("timeframe", sa.String(length=8), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("open", sa.Numeric(18, 6), nullable=False),
        sa.Column("high", sa.Numeric(18, 6), nullable=False),
        sa.Column("low", sa.Numeric(18, 6), nullable=False),
        sa.Column("close", sa.Numeric(18, 6), nullable=False),
        sa.Column("volume", sa.Numeric(24, 8), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["connection_id"], ["mt5_connections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "connection_id",
            "symbol",
            "timeframe",
            "timestamp",
            name="uq_broker_candle",
        ),
    )
    op.create_index("ix_broker_candles_account_id", "broker_candles", ["account_id"])
    op.create_index(
        "ix_broker_candles_lookup",
        "broker_candles",
        ["connection_id", "symbol", "timeframe", "timestamp"],
    )


def downgrade() -> None:
    op.drop_index("ix_broker_candles_lookup", table_name="broker_candles")
    op.drop_index("ix_broker_candles_account_id", table_name="broker_candles")
    op.drop_table("broker_candles")
