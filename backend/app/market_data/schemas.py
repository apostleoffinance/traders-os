from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Protocol, Sequence

from app.core.enums import Timeframe


MARKET_TIMEFRAMES: tuple[str, ...] = (
    Timeframe.M1.value,
    Timeframe.M5.value,
    Timeframe.M15.value,
    Timeframe.M30.value,
    Timeframe.H1.value,
    Timeframe.H4.value,
    Timeframe.D1.value,
)

FRESHNESS_SECONDS: dict[str, int] = {
    Timeframe.M1.value: 90,
    Timeframe.M5.value: 180,
    Timeframe.M15.value: 480,
    Timeframe.M30.value: 900,
    Timeframe.H1.value: 1800,
    Timeframe.H4.value: 7200,
    Timeframe.D1.value: 21600,
}


@dataclass(frozen=True)
class Candle:
    symbol: str
    provider: str
    timeframe: str
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal | None = None


@dataclass(frozen=True)
class Quote:
    symbol: str
    provider: str
    timestamp: datetime
    bid: Decimal | None
    ask: Decimal | None
    last: Decimal
    freshness: str


@dataclass(frozen=True)
class ProviderInstrument:
    symbol: str
    display_symbol: str
    asset_class: str
    provider: str
    timeframes: tuple[str, ...]
    quote_currency: str
    base_currency: str


class MarketDataProvider(Protocol):
    name: str
    asset_classes: tuple[str, ...]

    def enabled(self) -> bool: ...

    def get_instruments(self) -> Sequence[ProviderInstrument]: ...

    def supported_timeframes(self, symbol: str) -> Sequence[str]: ...

    def get_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 500,
    ) -> list[Candle]: ...

    def get_quote(self, symbol: str) -> Quote: ...
