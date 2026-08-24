"""Store screenshot bytes in Postgres for durable charts without object storage.

Revision ID: 0006_screenshot_bytes
Revises: 0005_push
Create Date: 2026-08-24
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006_screenshot_bytes"
down_revision: Union[str, None] = "0005_push"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("trade_screenshots", sa.Column("file_data", sa.LargeBinary(), nullable=True))


def downgrade() -> None:
    op.drop_column("trade_screenshots", "file_data")
