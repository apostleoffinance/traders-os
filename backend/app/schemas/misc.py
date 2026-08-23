from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.auth import ORMModel


class ChecklistItemIn(BaseModel):
    label: str = Field(min_length=1, max_length=255)
    sort_order: int = 0
    required: bool = False
    category: str = "setup_confirmation"
    kind: str = "manual"
    auto_key: str | None = None
    description: str | None = None


class ChecklistItemOut(ORMModel):
    id: UUID
    label: str
    description: str | None = None
    category: str
    kind: str
    auto_key: str | None = None
    sort_order: int
    required: bool


class ChecklistTemplateOut(ORMModel):
    id: UUID
    name: str
    description: str | None = None
    setup_id: UUID | None = None
    instrument: str | None = None
    is_default: bool
    active: bool = True
    items: list[ChecklistItemOut]


class ChecklistReplaceIn(BaseModel):
    name: str | None = None
    description: str | None = None
    instrument: str | None = None
    active: bool | None = None
    items: list[ChecklistItemIn]


class ChecklistTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    setup_id: UUID | None = None
    instrument: str | None = Field(default=None, max_length=32)
    description: str | None = None
    items: list[ChecklistItemIn] | None = None


class RiskEventOut(ORMModel):
    id: UUID
    account_id: UUID
    trade_id: UUID | None
    event_type: str
    severity: str
    message: str
    metric_value: Decimal | None
    threshold_value: Decimal | None
    created_at: datetime
