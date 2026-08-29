from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import Mt5ConnectionStatus
from app.db.base import Base
from app.models.types import MONEY, PRICE, QTY, UUID_PK


class Mt5Connection(Base):
    __tablename__ = "mt5_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("accounts.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default=Mt5ConnectionStatus.PENDING.value
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    token_prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    mt5_login: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mt5_server: Mapped[str | None] = mapped_column(String(128), nullable=True)
    broker_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    account: Mapped["Account"] = relationship(back_populates="mt5_connection")  # noqa: F821


class Mt5ProcessedDeal(Base):
    __tablename__ = "mt5_processed_deals"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("mt5_connections.id", ondelete="CASCADE"), nullable=False
    )
    deal_id: Mapped[str] = mapped_column(String(64), nullable=False)
    trade_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_PK, ForeignKey("trades.id", ondelete="SET NULL"), nullable=True
    )
    volume: Mapped[Decimal | None] = mapped_column(QTY, nullable=True)
    price: Mapped[Decimal | None] = mapped_column(PRICE, nullable=True)
    profit: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    commission: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    swap: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
