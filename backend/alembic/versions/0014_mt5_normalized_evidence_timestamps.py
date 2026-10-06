"""Store normalized UTC timestamps alongside raw broker timestamps."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0014_mt5_normalized_evidence_timestamps"
down_revision: Union[str, None] = "0013_mt5_source_deals"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mt5_sync_snapshots",
        sa.Column("sync_timestamp_utc", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "mt5_source_deals",
        sa.Column("deal_time_utc", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mt5_source_deals", "deal_time_utc")
    op.drop_column("mt5_sync_snapshots", "sync_timestamp_utc")
