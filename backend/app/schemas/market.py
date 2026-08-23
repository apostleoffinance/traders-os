from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.core.enums import Direction
from app.schemas.auth import ORMModel
from app.schemas.trade import ChecklistResponseIn


class SizeIn(BaseModel):
    account_id: UUID
    symbol: str
    direction: Direction = Direction.LONG
    entry: Decimal = Field(gt=0)
    stop_loss: Decimal = Field(gt=0)
    take_profit: Decimal | None = Field(default=None, gt=0)
    risk_amount: Decimal | None = Field(default=None, gt=0)
    lot_size: Decimal | None = Field(default=None, gt=0)


class AnnotationIn(BaseModel):
    type: str
    timestamp: datetime
    timestamp_end: datetime | None = None
    price: Decimal | None = None
    price_end: Decimal | None = None
    text: str | None = None
    extra: dict | None = None


class AnnotationOut(ORMModel):
    id: UUID
    analysis_id: UUID
    account_id: UUID | None
    symbol: str
    timeframe: str
    type: str
    timestamp: datetime
    timestamp_end: datetime | None
    price: Decimal | None
    price_end: Decimal | None
    text: str | None
    extra: dict | None
    created_at: datetime


class AnalysisIn(BaseModel):
    account_id: UUID
    symbol: str
    timeframe: str = "M15"
    setup_id: UUID | None = None
    direction: Direction | None = None
    analysis_timestamp: datetime | None = None
    entry: Decimal | None = None
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    planned_risk: Decimal | None = None
    position_size: Decimal | None = None
    thesis: str | None = None
    market_context: str | None = None
    liquidity_notes: str | None = None
    structure_notes: str | None = None
    rejection_notes: str | None = None
    psychology_state: str | None = None
    checklist_state: dict | None = None
    chart_range: dict | None = None
    status: str = "draft"
    annotations: list[AnnotationIn] = Field(default_factory=list)


class AnalysisUpdate(BaseModel):
    setup_id: UUID | None = None
    direction: Direction | None = None
    entry: Decimal | None = None
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    planned_risk: Decimal | None = None
    position_size: Decimal | None = None
    thesis: str | None = None
    market_context: str | None = None
    liquidity_notes: str | None = None
    structure_notes: str | None = None
    rejection_notes: str | None = None
    psychology_state: str | None = None
    checklist_state: dict | None = None
    chart_range: dict | None = None
    status: str | None = None
    annotations: list[AnnotationIn] | None = None


class AnalysisOut(ORMModel):
    id: UUID
    user_id: UUID
    account_id: UUID
    symbol: str
    timeframe: str
    session: str
    setup_id: UUID | None
    direction: str | None
    analysis_timestamp: datetime
    entry: Decimal | None
    stop_loss: Decimal | None
    take_profit: Decimal | None
    planned_risk: Decimal | None
    planned_rr: Decimal | None
    position_size: Decimal | None
    quote_to_account_rate: Decimal | None
    thesis: str | None
    market_context: str | None
    liquidity_notes: str | None
    structure_notes: str | None
    rejection_notes: str | None
    psychology_state: str | None
    checklist_state: dict | None
    chart_range: dict | None
    status: str
    created_at: datetime
    updated_at: datetime
    annotations: list[AnnotationOut] = Field(default_factory=list)


class TradePlanIn(BaseModel):
    create_trade: bool = False
    lot_size: Decimal | None = None
    acknowledged_warnings: bool = False
    notes: str | None = None
    checklist: list[ChecklistResponseIn] = Field(default_factory=list)
