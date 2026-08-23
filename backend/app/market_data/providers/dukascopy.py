"""Dukascopy public chart JSON — historical/delayed FX research data. No API key.

Uses freeserv.dukascopy.com chart/json3. This is NOT tick-by-tick live data.
"""

from __future__ import annotations

import json
import logging
import random
import string
import time
from datetime import datetime, timedelta, timezone
from typing import Sequence

from app.core.enums import AssetClass, DataFreshness, Timeframe
from app.core.exceptions import ProviderUnavailable
from app.engines.fx_math import INSTRUMENTS, normalize_symbol
from app.market_data.normalization import candle, parse_utc_ms, quote as make_quote
from app.market_data.providers.base import http_client, log_fetch, require_timeframe
from app.market_data.schemas import Candle, ProviderInstrument, Quote

log = logging.getLogger("traderos.market")

NAME = "dukascopy"
BASE_URL = "https://freeserv.dukascopy.com/2.0/index.php"

DUKASCOPY_INTERVAL = {
    Timeframe.M1.value: "1MIN",
    Timeframe.M5.value: "5MIN",
    Timeframe.M15.value: "15MIN",
    Timeframe.M30.value: "30MIN",
    Timeframe.H1.value: "1HOUR",
    Timeframe.H4.value: "4HOUR",
    Timeframe.D1.value: "1DAY",
}

# Public widget instrument ids. Extra pairs can be added without changing callers.
DUKASCOPY_IDS = {
    "EURUSD": "EUR/USD",
    "GBPUSD": "GBP/USD",
    "USDJPY": "USD/JPY",
    "AUDUSD": "AUD/USD",
    "NZDUSD": "NZD/USD",
    "USDCAD": "USD/CAD",
    "USDCHF": "USD/CHF",
    "XAUUSD": "XAU/USD",
}

HEADERS = {
    "User-Agent": "TraderOS/1.0 (analysis-journal; +https://localhost)",
    "Referer": "https://freeserv.dukascopy.com/2.0/",
}


def dukascopy_id(symbol: str) -> str | None:
    key = normalize_symbol(symbol)
    return DUKASCOPY_IDS.get(key)


class DukascopyProvider:
    name = NAME
    asset_classes = (AssetClass.FX.value, AssetClass.COMMODITY.value)

    def enabled(self) -> bool:
        return True

    def get_instruments(self) -> Sequence[ProviderInstrument]:
        tfs = tuple(DUKASCOPY_INTERVAL.keys())
        out: list[ProviderInstrument] = []
        for key, display in DUKASCOPY_IDS.items():
            spec = INSTRUMENTS.get(key)
            out.append(
                ProviderInstrument(
                    symbol=key,
                    display_symbol=display,
                    asset_class=spec.asset_class if spec else AssetClass.FX.value,
                    provider=NAME,
                    timeframes=tfs,
                    quote_currency=spec.quote_currency if spec else "USD",
                    base_currency=spec.base_currency if spec else key[:3],
                )
            )
        return out

    def supported_timeframes(self, symbol: str) -> Sequence[str]:
        if dukascopy_id(symbol) is None:
            return ()
        return tuple(DUKASCOPY_INTERVAL.keys())

    def get_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 500,
    ) -> list[Candle]:
        inst = dukascopy_id(symbol)
        if inst is None:
            raise ProviderUnavailable(f"Dukascopy does not list {symbol}.")
        tf = require_timeframe(timeframe, self.supported_timeframes(symbol), NAME)
        interval = DUKASCOPY_INTERVAL[tf]
        end_dt = end or datetime.now(timezone.utc)
        start_dt = start or (end_dt - _span_for(tf, limit))
        t0 = time.perf_counter()
        try:
            rows = _fetch_rows(inst, interval, start_dt, end_dt, limit=min(limit, 5000))
        except Exception as exc:
            log_fetch(NAME, symbol, tf, ok=False, ms=(time.perf_counter() - t0) * 1000)
            raise ProviderUnavailable("Market data temporarily unavailable.") from exc
        log_fetch(NAME, symbol, tf, ok=True, ms=(time.perf_counter() - t0) * 1000, extra=f"n={len(rows)}")
        key = normalize_symbol(symbol)
        candles: list[Candle] = []
        for row in rows:
            if not row or len(row) < 5:
                continue
            try:
                candles.append(
                    candle(
                        symbol=key,
                        provider=NAME,
                        timeframe=tf,
                        timestamp=parse_utc_ms(row[0]),
                        open_=row[1],
                        high=row[2],
                        low=row[3],
                        close=row[4],
                        volume=row[5] if len(row) > 5 else None,
                    )
                )
            except (ValueError, TypeError, IndexError):
                continue
        candles.sort(key=lambda c: c.timestamp)
        return candles[-limit:]

    def get_quote(self, symbol: str) -> Quote:
        bars = self.get_ohlcv(symbol, Timeframe.M1.value, limit=2)
        if not bars:
            raise ProviderUnavailable("No Dukascopy quote available.")
        last = bars[-1]
        return make_quote(
            symbol=last.symbol,
            provider=NAME,
            timestamp=last.timestamp,
            last=last.close,
            freshness=DataFreshness.DELAYED.value,
        )


def _span_for(timeframe: str, limit: int) -> timedelta:
    minutes = {
        Timeframe.M1.value: 1,
        Timeframe.M5.value: 5,
        Timeframe.M15.value: 15,
        Timeframe.M30.value: 30,
        Timeframe.H1.value: 60,
        Timeframe.H4.value: 240,
        Timeframe.D1.value: 1440,
    }.get(timeframe, 15)
    return timedelta(minutes=minutes * max(limit, 50) * 2)


def _fetch_rows(
    instrument: str,
    interval: str,
    start: datetime,
    end: datetime,
    *,
    limit: int,
) -> list[list]:
    jsonp = "_cb_" + "".join(random.choices(string.ascii_letters + string.digits, k=8))
    params = {
        "path": "chart/json3",
        "splits": "true",
        "stocks": "true",
        "time_direction": "N",
        "jsonp": jsonp,
        "last_update": str(int(start.timestamp() * 1000)),
        "offer_side": "B",
        "instrument": instrument,
        "interval": interval,
        "limit": str(limit),
    }
    with http_client() as client:
        response = client.get(BASE_URL, params=params, headers=HEADERS)
        response.raise_for_status()
    text = response.text.strip()
    if text.startswith(jsonp):
        text = text[len(jsonp) :].lstrip("(")
        if text.endswith(");"):
            text = text[:-2]
        elif text.endswith(")"):
            text = text[:-1]
    payload = json.loads(text)
    if not isinstance(payload, list):
        raise ProviderUnavailable("Malformed Dukascopy response.")
    end_ms = int(end.timestamp() * 1000)
    return [row for row in payload if isinstance(row, list) and row and int(row[0]) <= end_ms]
