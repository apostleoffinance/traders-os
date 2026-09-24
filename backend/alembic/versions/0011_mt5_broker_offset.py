"""MT5 connection broker UTC offset for correcting mislabeled server-time timestamps."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_mt5_broker_offset"
down_revision: Union[str, None] = "0010_trade_mfe_mae_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mt5_connections", sa.Column("broker_utc_offset_seconds", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("mt5_connections", "broker_utc_offset_seconds")
