from __future__ import annotations

from sqlalchemy import Numeric, Uuid

UUID_PK = Uuid(as_uuid=True)
MONEY = Numeric(18, 2)
PRICE = Numeric(18, 6)
QTY = Numeric(18, 4)
RATIO = Numeric(12, 4)
PERCENT = Numeric(12, 6)
