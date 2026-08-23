from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import Direction, SessionName, TradeResult, TradeStatus
from app.db.base import Base
from app.models.types import MONEY, PERCENT, PRICE, QTY, RATIO, UUID_PK


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("accounts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    direction: Mapped[str] = mapped_column(String(8), nullable=False, default=Direction.LONG.value)
    trade_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    exit_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False)
    session: Mapped[str] = mapped_column(String(32), nullable=False, default=SessionName.OUTSIDE.value)
    in_preferred_session: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    setup_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_PK, ForeignKey("setups.id", ondelete="SET NULL"), nullable=True
    )
    timeframe: Mapped[str] = mapped_column(String(8), nullable=False, default="M15")
    entry_price: Mapped[Decimal] = mapped_column(PRICE, nullable=False)
    exit_price: Mapped[Decimal | None] = mapped_column(PRICE, nullable=True)
    stop_loss: Mapped[Decimal] = mapped_column(PRICE, nullable=False)
    take_profit: Mapped[Decimal | None] = mapped_column(PRICE, nullable=True)
    lot_size: Mapped[Decimal] = mapped_column(QTY, nullable=False)
    stop_pips: Mapped[Decimal | None] = mapped_column(RATIO, nullable=True)
    tp_pips: Mapped[Decimal | None] = mapped_column(RATIO, nullable=True)
    risk_amount: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    risk_percent: Mapped[Decimal] = mapped_column(PERCENT, nullable=False, default=Decimal("0"))
    planned_reward: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    planned_rr: Mapped[Decimal | None] = mapped_column(RATIO, nullable=True)
    realized_pnl: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    realized_r: Mapped[Decimal | None] = mapped_column(RATIO, nullable=True)
    realized_rr: Mapped[Decimal | None] = mapped_column(RATIO, nullable=True)
    result: Mapped[str] = mapped_column(String(16), nullable=False, default=TradeResult.OPEN.value)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default=TradeStatus.OPEN.value)
    holding_time_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    setup_valid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    rules_followed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    emotional_trade: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mistake: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mistake_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    discipline_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    acknowledged_warnings: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    source_analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_PK, ForeignKey("market_analyses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped["Account"] = relationship(back_populates="trades")  # noqa: F821
    setup: Mapped["Setup | None"] = relationship(back_populates="trades")  # noqa: F821
    psychology: Mapped["Psychology | None"] = relationship(
        back_populates="trade", uselist=False, cascade="all, delete-orphan"
    )
    screenshots: Mapped[list["TradeScreenshot"]] = relationship(
        back_populates="trade", cascade="all, delete-orphan"
    )
    checklist_responses: Mapped[list["TradeChecklistResponse"]] = relationship(  # noqa: F821
        back_populates="trade", cascade="all, delete-orphan"
    )


class Psychology(Base):
    __tablename__ = "psychology"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    trade_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("trades.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    emotion_before: Mapped[str] = mapped_column(String(32), nullable=False, default="neutral")
    emotion_during: Mapped[str] = mapped_column(String(32), nullable=False, default="neutral")
    emotion_after: Mapped[str] = mapped_column(String(32), nullable=False, default="neutral")
    emotional_intensity: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    fear: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    fomo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    frustration: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    revenge: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    boredom: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    trade: Mapped[Trade] = relationship(back_populates="psychology")


class TradeScreenshot(Base):
    __tablename__ = "trade_screenshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    trade_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("trades.id", ondelete="CASCADE"), index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    content_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    trade: Mapped[Trade] = relationship(back_populates="screenshots")
