"""Retain successful MT5 sync payloads for reconciliation.

Revision ID: 0012_mt5_sync_snapshots
Revises: 0011_mt5_broker_offset
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_mt5_sync_snapshots"
down_revision: Union[str, None] = "0011_mt5_broker_offset"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mt5_sync_snapshots",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("connection_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=False),
        sa.Column("sync_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("positions_count", sa.Integer(), nullable=False),
        sa.Column("deals_count", sa.Integer(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["connection_id"], ["mt5_connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_mt5_sync_snapshots_connection_id", "mt5_sync_snapshots", ["connection_id"])
    op.create_index("ix_mt5_sync_snapshots_user_id", "mt5_sync_snapshots", ["user_id"])
    op.create_index("ix_mt5_sync_snapshots_account_id", "mt5_sync_snapshots", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_mt5_sync_snapshots_account_id", table_name="mt5_sync_snapshots")
    op.drop_index("ix_mt5_sync_snapshots_user_id", table_name="mt5_sync_snapshots")
    op.drop_index("ix_mt5_sync_snapshots_connection_id", table_name="mt5_sync_snapshots")
    op.drop_table("mt5_sync_snapshots")
