"""Persist individual source MT5 deals separately from trade projections."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_mt5_source_deals"
down_revision: Union[str, None] = "0012_mt5_sync_snapshots"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mt5_source_deals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("external_deal_id", sa.String(length=64), nullable=False),
        sa.Column("external_position_id", sa.String(length=64), nullable=False),
        sa.Column("symbol_raw", sa.String(length=64), nullable=False),
        sa.Column("direction", sa.String(length=8), nullable=False),
        sa.Column("entry_type", sa.String(length=16), nullable=False),
        sa.Column("volume", sa.Numeric(18, 4), nullable=False),
        sa.Column("price", sa.Numeric(18, 6), nullable=False),
        sa.Column("profit", sa.Numeric(18, 2), nullable=False),
        sa.Column("commission", sa.Numeric(18, 2), nullable=False),
        sa.Column("swap", sa.Numeric(18, 2), nullable=False),
        sa.Column("deal_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["connection_id"], ["mt5_connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("connection_id", "external_deal_id", name="uq_mt5_source_deal"),
    )
    op.create_index("ix_mt5_source_deals_connection_id", "mt5_source_deals", ["connection_id"])
    op.create_index("ix_mt5_source_deals_user_id", "mt5_source_deals", ["user_id"])
    op.create_index("ix_mt5_source_deals_account_id", "mt5_source_deals", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_mt5_source_deals_account_id", table_name="mt5_source_deals")
    op.drop_index("ix_mt5_source_deals_user_id", table_name="mt5_source_deals")
    op.drop_index("ix_mt5_source_deals_connection_id", table_name="mt5_source_deals")
    op.drop_table("mt5_source_deals")
