"""Cross-asset replay proof of concept backed by the canonical candle store.

Wrun is intentionally not used as a provider here: its public Wrun docs describe
an in-browser market-logic runtime, but do not expose a verified external candle
API or a confirmed FX instrument contract. This service tests TraderOS's own
provider-neutral persistence and synchronized replay path without inventing one.
"""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.core.enums import AssetClass
from app.core.exceptions import ProviderUnavailable, UnsupportedTimeframe
from app.core.time import as_utc
from app.engines.fx_math import get_instrument, normalize_symbol
from app.market_data import cache
from app.market_data.providers.router import providers_for_symbol
from app.market_data.schemas import MARKET_TIMEFRAMES


class ReplayWindowIn(BaseModel):
    """Request for one FX and one crypto series over a shared UTC window."""

    symbols: list[str] = Field(default_factory=lambda: ["EURUSD", "BTCUSDT"], min_length=2, max_length=2)
    timeframe: str = "M5"
    start: datetime
    end: datetime
    limit: int = Field(default=500, ge=10, le=1000)

    @model_validator(mode="after")
    def validate_window(self) -> "ReplayWindowIn":
        if self.start.tzinfo is None or self.start.utcoffset() is None:
            raise ValueError("start must include a timezone; use UTC timestamps.")
        if self.end.tzinfo is None or self.end.utcoffset() is None:
            raise ValueError("end must include a timezone; use UTC timestamps.")
        if self.end <= self.start:
            raise ValueError("end must be later than start.")
        if self.timeframe.upper() not in MARKET_TIMEFRAMES:
            raise ValueError(f"Unsupported timeframe. Use one of: {', '.join(MARKET_TIMEFRAMES)}.")
        keys = [normalize_symbol(s) for s in self.symbols]
        if len(set(keys)) != 2:
            raise ValueError("symbols must be two different instruments.")
        assets = {get_instrument(key).asset_class for key in keys}
        if assets != {AssetClass.FX.value, AssetClass.CRYPTO.value}:
            raise ValueError("Choose exactly one FX instrument and one crypto instrument.")
        self.symbols = keys
        self.timeframe = self.timeframe.upper()
        return self


def _iso(value: datetime) -> str:
    return as_utc(value).isoformat().replace("+00:00", "Z")


def _decimal(value: Decimal | None) -> str | None:
    return format(value, "f") if value is not None else None


def _candle_payload(candle: Any) -> dict[str, Any]:
    return {
        "symbol": candle.symbol,
        "provider": candle.provider,
        "timeframe": candle.timeframe,
        "timestamp": _iso(candle.timestamp),
        "open": _decimal(candle.open),
        "high": _decimal(candle.high),
        "low": _decimal(candle.low),
        "close": _decimal(candle.close),
        "volume": _decimal(candle.volume),
    }


def _fetch_series(symbol: str, timeframe: str, start: datetime, end: datetime, limit: int):
    last_error: Exception | None = None
    for provider in providers_for_symbol(symbol):
        try:
            bars = provider.get_ohlcv(symbol, timeframe, start=start, end=end, limit=limit)
            bars = [bar for bar in bars if start <= as_utc(bar.timestamp) <= end]
            if bars:
                bars.sort(key=lambda bar: as_utc(bar.timestamp))
                return provider, bars[-limit:]
        except UnsupportedTimeframe:
            last_error = UnsupportedTimeframe(f"{provider.name} does not support {timeframe} for {symbol}.")
        except Exception as exc:
            last_error = exc
    raise ProviderUnavailable(
        f"No provider returned historical candles for {symbol} in the requested window."
    ) from last_error


def build_replay_window(db: Session, request: ReplayWindowIn) -> dict[str, Any]:
    """Fetch both series, persist atomically, and return a deterministic replay tape."""
    start = as_utc(request.start)
    end = as_utc(request.end)
    series: list[dict[str, Any]] = []

    # Fetch both datasets before writing anything: partial runs must not appear successful.
    try:
        for symbol in request.symbols:
            provider, bars = _fetch_series(symbol, request.timeframe, start, end, request.limit)
            series.append({"symbol": symbol, "provider": provider.name, "bars": bars})
        for item in series:
            cache.persist_candles(db, item["bars"])
        db.commit()
    except Exception:
        db.rollback()
        raise

    timeline: list[dict[str, Any]] = []
    payload_series: list[dict[str, Any]] = []
    for item in series:
        candle_rows = [_candle_payload(bar) for bar in item["bars"]]
        payload_series.append({
            "symbol": item["symbol"],
            "asset_class": get_instrument(item["symbol"]).asset_class,
            "provider": item["provider"],
            "count": len(candle_rows),
            "first_timestamp": candle_rows[0]["timestamp"],
            "last_timestamp": candle_rows[-1]["timestamp"],
            "candles": candle_rows,
        })
        timeline.extend({
            "timestamp": row["timestamp"],
            "symbol": row["symbol"],
            "provider": row["provider"],
            "open": row["open"],
            "high": row["high"],
            "low": row["low"],
            "close": row["close"],
            "volume": row["volume"],
        } for row in candle_rows)
    timeline.sort(key=lambda row: (row["timestamp"], row["symbol"]))

    return {
        "status": "ok",
        "mode": "historical_cross_asset_replay",
        "window": {"start": _iso(start), "end": _iso(end), "timezone": "UTC"},
        "timeframe": request.timeframe,
        "persisted_to": "market_candles",
        "series": payload_series,
        "timeline": timeline,
        "timeline_count": len(timeline),
        "caveats": [
            "FX and crypto candles come from their named providers, not one consolidated venue.",
            "Candle replay does not reproduce tick ordering, bid/ask spread, or executable fills.",
            "This validates TraderOS persistence and replay, not Wrun API compatibility.",
        ],
    }
