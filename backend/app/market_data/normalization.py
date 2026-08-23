from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

from app.core.time import as_utc
from app.engines.fx_math import MONEY_Q, PRICE_Q, money
from app.market_data.schemas import Candle, Quote


def _dec(value: object, quant: Decimal | None = None) -> Decimal:
    if isinstance(value, Decimal):
        d = value
    else:
        d = Decimal(str(value))
    if quant is not None:
        return d.quantize(quant)
    return d


def parse_utc_ms(ms: int | float) -> datetime:
    return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)


def parse_utc(value: datetime | str) -> datetime:
    if isinstance(value, datetime):
        return as_utc(value)
    return as_utc(datetime.fromisoformat(value.replace("Z", "+00:00")))


def validate_ohlc(open_: Decimal, high: Decimal, low: Decimal, close: Decimal) -> None:
    if high < low:
        raise ValueError("high < low")
    if high < open_ or high < close:
        raise ValueError("high is below open/close")
    if low > open_ or low > close:
        raise ValueError("low is above open/close")


def candle(
    *,
    symbol: str,
    provider: str,
    timeframe: str,
    timestamp: datetime,
    open_: object,
    high: object,
    low: object,
    close: object,
    volume: object | None = None,
) -> Candle:
    o = _dec(open_)
    h = _dec(high)
    lo = _dec(low)
    c = _dec(close)
    validate_ohlc(o, h, lo, c)
    vol = None
    if volume is not None and str(volume) not in {"", "None"}:
        try:
            vol = _dec(volume)
        except (InvalidOperation, ValueError):
            vol = None
    return Candle(
        symbol=symbol,
        provider=provider,
        timeframe=timeframe,
        timestamp=as_utc(timestamp),
        open=o,
        high=h,
        low=lo,
        close=c,
        volume=vol,
    )


def quote(
    *,
    symbol: str,
    provider: str,
    timestamp: datetime,
    last: object,
    bid: object | None = None,
    ask: object | None = None,
    freshness: str = "delayed",
) -> Quote:
    return Quote(
        symbol=symbol,
        provider=provider,
        timestamp=as_utc(timestamp),
        last=_dec(last),
        bid=_dec(bid) if bid is not None else None,
        ask=_dec(ask) if ask is not None else None,
        freshness=freshness,
    )


def money_or_none(value: Decimal | None) -> Decimal | None:
    if value is None:
        return None
    return money(value)


def price_or_none(value: Decimal | None) -> Decimal | None:
    if value is None:
        return None
    return value.quantize(PRICE_Q)
