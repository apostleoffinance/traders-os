from __future__ import annotations

from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class CalcModeIn(StrEnum):
    RISK_TO_LEVELS = "risk_to_levels"
    ENTRY_SL_TO_SIZE = "entry_sl_to_size"
    TRADE_ANALYSIS = "trade_analysis"
    TARGET_DISTANCE = "target_distance"
    FIXED_RISK_SL = "fixed_risk_sl"


class CalculatorCalculateIn(BaseModel):
    account_id: UUID
    mode: CalcModeIn = CalcModeIn.FIXED_RISK_SL
    symbol: str
    direction: str = Field(pattern="^(long|short)$")
    entry: Decimal = Field(gt=0)
    lot_size: Decimal | None = Field(default=None, gt=0)
    stop_loss: Decimal | None = Field(default=None, gt=0)
    take_profit: Decimal | None = Field(default=None, gt=0)
    risk_amount: Decimal | None = Field(default=None, gt=0)
    reward_amount: Decimal | None = Field(default=None, gt=0)
    risk_percent: Decimal | None = Field(default=None, gt=0, le=100)
    quote_to_account_rate: Decimal | None = Field(default=None, gt=0)
    allow_stale_conversion: bool = False


class CalculatorParseIn(BaseModel):
    account_id: UUID
    text: str = Field(min_length=3, max_length=2000)


class CalculatorExplainIn(BaseModel):
    account_id: UUID
    calculation: dict
    policy: dict | None = None
