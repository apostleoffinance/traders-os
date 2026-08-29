"""Trade MFE/MAE excursion fields from MT5 M1 bars."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_trade_mfe_mae"
down_revision: Union[str, None] = "0007_mt5_sync"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("trades", sa.Column("mfe_price", sa.Numeric(18, 6), nullable=True))
    op.add_column("trades", sa.Column("mae_price", sa.Numeric(18, 6), nullable=True))
    op.add_column("trades", sa.Column("mfe_r", sa.Numeric(12, 4), nullable=True))
    op.add_column("trades", sa.Column("mae_r", sa.Numeric(12, 4), nullable=True))
    op.add_column("trades", sa.Column("mfe_mae_source", sa.String(length=16), nullable=True))
    op.add_column("trades", sa.Column("mfe_mae_precision", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("trades", "mfe_mae_precision")
    op.drop_column("trades", "mfe_mae_source")
    op.drop_column("trades", "mae_r")
    op.drop_column("trades", "mfe_r")
    op.drop_column("trades", "mae_price")
    op.drop_column("trades", "mfe_price")
