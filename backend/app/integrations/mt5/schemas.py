from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class Mt5AccountIn(BaseModel):
    login: int
    server: str
    company: str | None = None
    currency: str | None = None
    balance: Decimal | None = None
    equity: Decimal | None = None


class Mt5PositionIn(BaseModel):
    external_position_id: str
    symbol_raw: str
    direction: Literal["LONG", "SHORT"]
    volume: Decimal = Field(gt=0)
    entry_price: Decimal = Field(gt=0)
    current_price: Decimal | None = None
    stop_loss: Decimal | None = None
    take_profit: Decimal | None = None
    opened_at: datetime
    unrealized_pnl: Decimal | None = None
    swap: Decimal | None = None
    commission: Decimal | None = None
    magic: int | None = None
    comment: str | None = None


class Mt5DealIn(BaseModel):
    external_deal_id: str
    external_position_id: str
    symbol_raw: str
    direction: Literal["LONG", "SHORT"]
    entry_type: Literal["IN", "OUT", "INOUT", "OUT_BY"]
    volume: Decimal = Field(gt=0)
    price: Decimal = Field(gt=0)
    profit: Decimal = Decimal("0")
    commission: Decimal = Decimal("0")
    swap: Decimal = Decimal("0")
    deal_time: datetime
    mfe_price: Decimal | None = None
    mae_price: Decimal | None = None
    mfe_mae_bars: int | None = None


class Mt5SyncIn(BaseModel):
    event_type: Literal["sync", "heartbeat"] = "sync"
    platform: Literal["MT5"] = "MT5"
    sync_timestamp: datetime
    terminal_connected: bool = True
    account: Mt5AccountIn | None = None
    positions: list[Mt5PositionIn] = Field(default_factory=list)
    recent_deals: list[Mt5DealIn] = Field(default_factory=list)


class Mt5SyncOut(BaseModel):
    success: bool
    connection_status: str
    trades_created: int = 0
    trades_updated: int = 0
    trades_closed: int = 0
    server_time: datetime


class Mt5ConnectionCreateIn(BaseModel):
    account_id: UUID


class Mt5ConnectionOut(BaseModel):
    id: UUID
    account_id: UUID
    status: str
    token_prefix: str
    mt5_login: str | None = None
    mt5_server: str | None = None
    broker_name: str | None = None
    last_seen_at: datetime | None = None
    last_sync_at: datetime | None = None
    created_at: datetime
    revoked_at: datetime | None = None


class Mt5ConnectionCreatedOut(Mt5ConnectionOut):
    connection_token: str
