from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import Direction, Emotion, ScreenshotType, Timeframe
from app.schemas.auth import ORMModel


class PsychologyIn(BaseModel):
    emotion_before: Emotion = Emotion.NEUTRAL
    emotion_during: Emotion = Emotion.NEUTRAL
    emotion_after: Emotion = Emotion.NEUTRAL
    emotional_intensity: int = Field(ge=0, le=10, default=5)
    confidence: int = Field(ge=0, le=10, default=5)
    fear: int = Field(ge=0, le=10, default=0)
    fomo: int = Field(ge=0, le=10, default=0)
    frustration: int = Field(ge=0, le=10, default=0)
    revenge: int = Field(ge=0, le=10, default=0)
    boredom: int = Field(ge=0, le=10, default=0)
    notes: str | None = None


class PsychologyOut(ORMModel, PsychologyIn):
    id: UUID
    trade_id: UUID


class ChecklistResponseIn(BaseModel):
    item_id: UUID
    checked: bool


class ChecklistResponseOut(ORMModel):
    item_id: UUID
    checked: bool
    label: str | None = None
    category: str | None = None
    kind: str | None = None
    auto_key: str | None = None
    required: bool | None = None


class ScreenshotOut(ORMModel):
    id: UUID
    type: str
    storage_key: str
    url: str
    original_filename: str | None
    created_at: datetime


class TradePreviewIn(BaseModel):
    account_id: UUID
    symbol: str = Field(default="EURUSD")
    direction: Direction
    entry_price: Decimal = Field(gt=0)
    stop_loss: Decimal = Field(gt=0)
    take_profit: Decimal | None = Field(default=None, gt=0)
    lot_size: Decimal = Field(gt=0)
    exit_price: Decimal | None = Field(default=None, gt=0)
    quote_to_account_rate: Decimal = Field(default=Decimal("1"), gt=0)
    trade_timestamp: datetime | None = None


class AutoCheckOut(BaseModel):
    auto_key: str
    label: str
    passed: bool
    status: str
    display: str
    value: Decimal | None = None
    threshold: Decimal | None = None


class PolicyPreviewOut(BaseModel):
    allowed: bool
    requires_confirmation: bool
    block_reason: str | None = None


class TradeCreate(BaseModel):
    account_id: UUID
    symbol: str = Field(default="EURUSD", max_length=32)
    direction: Direction
    trade_timestamp: datetime
    exit_timestamp: datetime | None = None
    timezone: str | None = None
    setup_id: UUID | None = None
    timeframe: Timeframe = Timeframe.M15
    entry_price: Decimal = Field(gt=0)
    exit_price: Decimal | None = Field(default=None, gt=0)
    stop_loss: Decimal = Field(gt=0)
    take_profit: Decimal | None = Field(default=None, gt=0)
    lot_size: Decimal = Field(gt=0)
    quote_to_account_rate: Decimal = Field(default=Decimal("1"), gt=0)
    setup_valid: bool = True
    rules_followed: bool = True
    emotional_trade: bool = False
    mistake: bool = False
    mistake_notes: str | None = None
    notes: str | None = None
    acknowledged_warnings: bool = False
    source: str = "manual"
    source_analysis_id: UUID | None = None
    psychology: PsychologyIn | None = None
    checklist: list[ChecklistResponseIn] = Field(default_factory=list)


class TradeUpdate(BaseModel):
    symbol: str | None = Field(default=None, max_length=32)
    direction: Direction | None = None
    trade_timestamp: datetime | None = None
    exit_timestamp: datetime | None = None
    setup_id: UUID | None = None
    timeframe: Timeframe | None = None
    entry_price: Decimal | None = Field(default=None, gt=0)
    exit_price: Decimal | None = Field(default=None, gt=0)
    stop_loss: Decimal | None = Field(default=None, gt=0)
    take_profit: Decimal | None = Field(default=None, gt=0)
    lot_size: Decimal | None = Field(default=None, gt=0)
    quote_to_account_rate: Decimal | None = Field(default=None, gt=0)
    setup_valid: bool | None = None
    rules_followed: bool | None = None
    emotional_trade: bool | None = None
    mistake: bool | None = None
    mistake_notes: str | None = None
    notes: str | None = None
    psychology: PsychologyIn | None = None
    checklist: list[ChecklistResponseIn] | None = None
    acknowledged_warnings: bool | None = None


class TradeClose(BaseModel):
    exit_price: Decimal = Field(gt=0)
    exit_timestamp: datetime | None = None
    notes: str | None = None
    setup_valid: bool | None = None
    rules_followed: bool | None = None
    emotional_trade: bool | None = None
    mistake: bool | None = None
    mistake_notes: str | None = None
    psychology: PsychologyIn | None = None


class TradeOut(ORMModel):
    id: UUID
    user_id: UUID
    account_id: UUID
    symbol: str
    direction: str
    trade_timestamp: datetime
    exit_timestamp: datetime | None
    timezone: str
    session: str
    in_preferred_session: bool
    setup_id: UUID | None
    setup_name: str | None = None
    timeframe: str
    entry_price: Decimal
    exit_price: Decimal | None
    stop_loss: Decimal
    take_profit: Decimal | None
    lot_size: Decimal
    stop_pips: Decimal | None
    tp_pips: Decimal | None
    risk_amount: Decimal
    risk_percent: Decimal
    planned_reward: Decimal | None
    planned_rr: Decimal | None
    realized_pnl: Decimal | None
    realized_r: Decimal | None
    realized_rr: Decimal | None
    result: str
    status: str
    holding_time_seconds: int | None
    setup_valid: bool
    rules_followed: bool
    emotional_trade: bool
    mistake: bool
    mistake_notes: str | None
    notes: str | None
    discipline_score: int | None
    acknowledged_warnings: bool
    source: str = "manual"
    source_analysis_id: UUID | None = None
    external_provider: str | None = None
    external_position_id: str | None = None
    symbol_raw: str | None = None
    instrument_status: str | None = None
    commission: Decimal | None = None
    swap: Decimal | None = None
    created_at: datetime
    psychology: PsychologyOut | None = None
    screenshots: list[ScreenshotOut] = Field(default_factory=list)
    checklist: list[ChecklistResponseOut] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class TradePreviewOut(BaseModel):
    symbol: str
    stop_pips: Decimal
    tp_pips: Decimal | None
    risk_amount: Decimal
    risk_percent: Decimal
    planned_reward: Decimal | None
    planned_rr: Decimal | None
    estimated_pnl_at_tp: Decimal | None
    estimated_realized_pnl: Decimal | None = None
    estimated_realized_r: Decimal | None = None
    estimated_result: str | None = None
    validation_notes: list[str]
    warnings: list[str]
    session: str | None = None
    in_preferred_session: bool = False
    process_status: str = "valid"
    policy: PolicyPreviewOut | None = None
    auto_checks: list[AutoCheckOut] = Field(default_factory=list)
    trades_today: int = 0
    max_trades_per_day: int | None = None
