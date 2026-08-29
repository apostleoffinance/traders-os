"""MT5 sync connections and external trade identifiers.

Revision ID: 0007_mt5_sync
Revises: 0006_screenshot_bytes
Create Date: 2026-08-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007_mt5_sync"
down_revision: Union[str, None] = "0006_screenshot_bytes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mt5_connections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("token_prefix", sa.String(length=16), nullable=False),
        sa.Column("mt5_login", sa.String(length=32), nullable=True),
        sa.Column("mt5_server", sa.String(length=128), nullable=True),
        sa.Column("broker_name", sa.String(length=128), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", name="uq_mt5_connections_account_id"),
    )
    op.create_index("ix_mt5_connections_user_id", "mt5_connections", ["user_id"])
    op.create_index("ix_mt5_connections_token_hash", "mt5_connections", ["token_hash"], unique=True)

    op.add_column("trades", sa.Column("external_provider", sa.String(length=16), nullable=True))
    op.add_column("trades", sa.Column("external_position_id", sa.String(length=64), nullable=True))
    op.add_column("trades", sa.Column("external_deal_id", sa.String(length=64), nullable=True))
    op.add_column("trades", sa.Column("symbol_raw", sa.String(length=64), nullable=True))
    op.add_column("trades", sa.Column("instrument_status", sa.String(length=16), nullable=True))
    op.add_column("trades", sa.Column("commission", sa.Numeric(18, 2), nullable=True))
    op.add_column("trades", sa.Column("swap", sa.Numeric(18, 2), nullable=True))
    op.create_index(
        "ix_trades_external_position",
        "trades",
        ["account_id", "external_provider", "external_position_id"],
        unique=True,
    )

    op.create_table(
        "mt5_processed_deals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("deal_id", sa.String(length=64), nullable=False),
        sa.Column("trade_id", sa.Uuid(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["connection_id"], ["mt5_connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("connection_id", "deal_id", name="uq_mt5_processed_deals"),
    )


def downgrade() -> None:
    op.drop_table("mt5_processed_deals")
    op.drop_index("ix_trades_external_position", table_name="trades")
    op.drop_column("trades", "swap")
    op.drop_column("trades", "commission")
    op.drop_column("trades", "instrument_status")
    op.drop_column("trades", "symbol_raw")
    op.drop_column("trades", "external_deal_id")
    op.drop_column("trades", "external_position_id")
    op.drop_column("trades", "external_provider")
    op.drop_index("ix_mt5_connections_token_hash", table_name="mt5_connections")
    op.drop_index("ix_mt5_connections_user_id", table_name="mt5_connections")
    op.drop_table("mt5_connections")
