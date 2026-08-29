"""MT5 processed deal economics for partial-close aggregation."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_mt5_deal_economics"
down_revision: Union[str, None] = "0008_trade_mfe_mae"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mt5_processed_deals", sa.Column("volume", sa.Numeric(18, 4), nullable=True))
    op.add_column("mt5_processed_deals", sa.Column("price", sa.Numeric(18, 6), nullable=True))
    op.add_column("mt5_processed_deals", sa.Column("profit", sa.Numeric(18, 2), nullable=True))
    op.add_column("mt5_processed_deals", sa.Column("commission", sa.Numeric(18, 2), nullable=True))
    op.add_column("mt5_processed_deals", sa.Column("swap", sa.Numeric(18, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("mt5_processed_deals", "swap")
    op.drop_column("mt5_processed_deals", "commission")
    op.drop_column("mt5_processed_deals", "profit")
    op.drop_column("mt5_processed_deals", "price")
    op.drop_column("mt5_processed_deals", "volume")
