"""Trade MFE/MAE first-touch timestamps for anatomy timing."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_trade_mfe_mae_at"
down_revision: Union[str, None] = "0009_mt5_deal_economics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("trades", sa.Column("mfe_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("trades", sa.Column("mae_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("trades", "mae_at")
    op.drop_column("trades", "mfe_at")
