from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.base import Base
from app.models.types import MONEY, PRICE, QTY, RATIO, UUID_PK

JSONType = JSON().with_variant(JSONB(), "postgresql")


class MarketCandle(Base):
    __tablename__ = "market_candles"
    __table_args__ = (
        UniqueConstraint("provider", "symbol", "timeframe", "timestamp", name="uq_market_candle"),
        Index("ix_market_candles_symbol_tf_ts", "symbol", "timeframe", "timestamp"),
        Index("ix_market_candles_timestamp", "timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    timeframe: Mapped[str] = mapped_column(String(8), nullable=False, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    open: Mapped[Decimal] = mapped_column(PRICE, nullable=False)
    high: Mapped[Decimal] = mapped_column(PRICE, nullable=False)
    low: Mapped[Decimal] = mapped_column(PRICE, nullable=False)
    close: Mapped[Decimal] = mapped_column(PRICE, nullable=False)
    volume: Mapped[Decimal | None] = mapped_column(Numeric(24, 8), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class BrokerCandle(Base):
    """OHLC bars pushed by a broker connection. Never mixed with another provider's series."""

    __tablename__ = "broker_candles"
    __table_args__ = (
        UniqueConstraint(
            "connection_id",
            "symbol",
            "timeframe",
            "timestamp",
            name="uq_broker_candle",
        ),
        Index("ix_broker_candles_lookup", "connection_id", "symbol", "timeframe", "timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("mt5_connections.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(8), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    open: Mapped[Decimal] = mapped_column(PRICE, nullable=False)
    high: Mapped[Decimal] = mapped_column(PRICE, nullable=False)
    low: Mapped[Decimal] = mapped_column(PRICE, nullable=False)
    close: Mapped[Decimal] = mapped_column(PRICE, nullable=False)
    volume: Mapped[Decimal | None] = mapped_column(Numeric(24, 8), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MarketAnalysis(Base):
    __tablename__ = "market_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("accounts.id", ondelete="CASCADE"), index=True, nullable=False
    )
    symbol: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    timeframe: Mapped[str] = mapped_column(String(8), nullable=False)
    session: Mapped[str] = mapped_column(String(32), nullable=False, default="outside")
    setup_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_PK, ForeignKey("setups.id", ondelete="SET NULL"), nullable=True
    )
    direction: Mapped[str | None] = mapped_column(String(8), nullable=True)
    analysis_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    entry: Mapped[Decimal | None] = mapped_column(PRICE, nullable=True)
    stop_loss: Mapped[Decimal | None] = mapped_column(PRICE, nullable=True)
    take_profit: Mapped[Decimal | None] = mapped_column(PRICE, nullable=True)
    planned_risk: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    planned_rr: Mapped[Decimal | None] = mapped_column(RATIO, nullable=True)
    position_size: Mapped[Decimal | None] = mapped_column(QTY, nullable=True)
    quote_to_account_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 8), nullable=True)
    thesis: Mapped[str | None] = mapped_column(Text, nullable=True)
    market_context: Mapped[str | None] = mapped_column(Text, nullable=True)
    liquidity_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    structure_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    psychology_state: Mapped[str | None] = mapped_column(String(32), nullable=True)
    checklist_state: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    chart_range: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    annotations: Mapped[list["ChartAnnotation"]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan"
    )


class ChartAnnotation(Base):
    __tablename__ = "chart_annotations"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("market_analyses.id", ondelete="CASCADE"), index=True, nullable=False
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID_PK, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True
    )
    symbol: Mapped[str] = mapped_column(String(32), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(8), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    timestamp_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    price: Mapped[Decimal | None] = mapped_column(PRICE, nullable=True)
    price_end: Mapped[Decimal | None] = mapped_column(PRICE, nullable=True)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra: Mapped[dict | None] = mapped_column(JSONType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    analysis: Mapped[MarketAnalysis] = relationship(back_populates="annotations")



class TradeMarketSnapshot(Base):
    """Immutable display snapshot linking a canonical trade to the market data used for replay."""

    __tablename__ = "trade_market_snapshots"
    __table_args__ = (
        UniqueConstraint("trade_id", "timeframe", "fingerprint", name="uq_trade_market_snapshot_fingerprint"),
        Index("ix_trade_market_snapshots_trade_created", "trade_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    trade_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("trades.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(8), nullable=False)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    candle_count: Mapped[int] = mapped_column(nullable=False)
    gap_count: Mapped[int] = mapped_column(nullable=False, default=0)
    largest_gap_seconds: Mapped[int] = mapped_column(nullable=False, default=0)
    coverage_status: Mapped[str] = mapped_column(String(16), nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    snapshot_json: Mapped[dict] = mapped_column(JSONType, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
