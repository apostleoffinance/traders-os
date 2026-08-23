from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import AccountStatus, DrawdownBasis, EnforcementMode
from app.db.base import Base
from app.models.types import MONEY, RATIO, UUID_PK


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    firm: Mapped[str] = mapped_column(String(120), nullable=False)
    program: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    account_name: Mapped[str] = mapped_column(String(160), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="USD")
    starting_balance: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    current_balance: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    current_equity: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default=AccountStatus.ACTIVE.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="accounts")  # noqa: F821
    risk_profile: Mapped["AccountRiskProfile"] = relationship(
        back_populates="account", uselist=False, cascade="all, delete-orphan"
    )
    trades: Mapped[list["Trade"]] = relationship(back_populates="account")  # noqa: F821


class AccountRiskProfile(Base):
    __tablename__ = "account_risk_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID_PK, primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID_PK, ForeignKey("accounts.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    risk_per_trade: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    personal_daily_loss_limit: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    personal_max_drawdown: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    firm_daily_drawdown_limit: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    firm_max_drawdown_limit: Mapped[Decimal] = mapped_column(MONEY, nullable=False)
    max_trades_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    preferred_min_rr: Mapped[Decimal] = mapped_column(RATIO, nullable=False, default=Decimal("1.50"))
    preferred_rr: Mapped[Decimal] = mapped_column(RATIO, nullable=False, default=Decimal("2.00"))
    minimum_trading_days: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    profit_split: Mapped[Decimal | None] = mapped_column(RATIO, nullable=True)
    payout_cap: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    hard_risk_per_trade: Mapped[Decimal | None] = mapped_column(MONEY, nullable=True)
    risk_per_trade_enforcement: Mapped[str] = mapped_column(
        String(16), nullable=False, default=EnforcementMode.CONFIRM.value
    )
    hard_risk_enforcement: Mapped[str] = mapped_column(
        String(16), nullable=False, default=EnforcementMode.BLOCK.value
    )
    drawdown_basis: Mapped[str] = mapped_column(
        String(32), nullable=False, default=DrawdownBasis.HIGH_WATER_MARK.value
    )
    # JSON list: [{name, timezone, start, end}]
    preferred_windows: Mapped[dict | list] = mapped_column(JSON, nullable=False, default=list)
    extra_restrictions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped[Account] = relationship(back_populates="risk_profile")
