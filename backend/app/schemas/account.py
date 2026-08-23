from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import AccountStatus, DrawdownBasis, EnforcementMode
from app.schemas.auth import ORMModel


class PreferredWindowIn(BaseModel):
    name: str
    timezone: str
    start: str = Field(description="HH:MM")
    end: str = Field(description="HH:MM")


class RiskProfileIn(BaseModel):
    risk_per_trade: Decimal = Field(gt=0)
    personal_daily_loss_limit: Decimal = Field(gt=0)
    personal_max_drawdown: Decimal = Field(gt=0)
    firm_daily_drawdown_limit: Decimal = Field(gt=0)
    firm_max_drawdown_limit: Decimal = Field(gt=0)
    max_trades_per_day: int = Field(ge=1, default=2)
    preferred_min_rr: Decimal = Field(gt=0, default=Decimal("1.50"))
    preferred_rr: Decimal = Field(gt=0, default=Decimal("2.00"))
    minimum_trading_days: int = Field(ge=0, default=5)
    profit_split: Decimal | None = None
    payout_cap: Decimal | None = None
    hard_risk_per_trade: Decimal | None = None
    risk_per_trade_enforcement: EnforcementMode = EnforcementMode.CONFIRM
    hard_risk_enforcement: EnforcementMode = EnforcementMode.BLOCK
    drawdown_basis: DrawdownBasis = DrawdownBasis.HIGH_WATER_MARK
    preferred_windows: list[PreferredWindowIn] = Field(default_factory=list)
    extra_restrictions: dict = Field(default_factory=dict)
    notes: str | None = None


class RiskProfileOut(ORMModel, RiskProfileIn):
    id: UUID
    account_id: UUID
    created_at: datetime
    updated_at: datetime


class AccountCreate(BaseModel):
    firm: str = Field(min_length=1, max_length=120)
    program: str = Field(default="", max_length=120)
    account_name: str = Field(min_length=1, max_length=160)
    currency: str = Field(default="USD", max_length=8)
    starting_balance: Decimal = Field(gt=0)
    template: str | None = Field(
        default=None,
        description="Optional preset: tentrade_tenedge_1k",
    )
    risk_profile: RiskProfileIn | None = None


class AccountUpdate(BaseModel):
    firm: str | None = None
    program: str | None = None
    account_name: str | None = None
    status: AccountStatus | None = None


class AccountOut(ORMModel):
    id: UUID
    user_id: UUID
    firm: str
    program: str
    account_name: str
    currency: str
    starting_balance: Decimal
    current_balance: Decimal
    current_equity: Decimal
    status: str
    created_at: datetime
    updated_at: datetime
    risk_profile: RiskProfileOut | None = None
