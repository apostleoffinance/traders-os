"""CCXT public market data. No exchange API keys required for OHLCV/tickers."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Sequence

from app.core.config import settings
from app.core.enums import AssetClass, DataFreshness, Timeframe
from app.core.exceptions import ProviderUnavailable
from app.engines.fx_math import INSTRUMENTS, normalize_symbol
from app.market_data.normalization import candle, parse_utc_ms, quote as make_quote
from app.market_data.providers.base import log_fetch, require_timeframe
from app.market_data.schemas import Candle, ProviderInstrument, Quote

log = logging.getLogger("traderos.market")

CCXT_TIMEFRAME = {
    Timeframe.M1.value: "1m",
    Timeframe.M5.value: "5m",
    Timeframe.M15.value: "15m",
    Timeframe.M30.value: "30m",
    Timeframe.H1.value: "1h",
    Timeframe.H4.value: "4h",
    Timeframe.D1.value: "1d",
}

DEFAULT_MARKETS = ("BTC/USDT", "ETH/USDT", "SOL/USDT")


def _exchange_names() -> list[str]:
    return [n.strip() for n in settings.ccxt_exchanges.split(",") if n.strip()]


def to_ccxt_symbol(symbol: str) -> str:
    key = normalize_symbol(symbol)
    spec = INSTRUMENTS.get(key)
    if spec and spec.display_symbol:
        return spec.display_symbol
    if "/" in symbol:
        return symbol.upper()
    if key.endswith("USDT") and len(key) > 4:
        return f"{key[:-4]}/USDT"
    return symbol.upper()


class CcxtProvider:
    name = "ccxt"
    asset_classes = (AssetClass.CRYPTO.value,)

    def __init__(self, exchange_id: str | None = None):
        self.exchange_id = exchange_id or _exchange_names()[0]
        self.name = self.exchange_id
        self._client = None

    def enabled(self) -> bool:
        return True

    def _ex(self):
        if self._client is not None:
            return self._client
        try:
            import ccxt  # type: ignore
        except ImportError as exc:
            raise ProviderUnavailable("ccxt is not installed.") from exc
        cls = getattr(ccxt, self.exchange_id, None)
        if cls is None:
            raise ProviderUnavailable(f"Unknown CCXT exchange '{self.exchange_id}'.")
        client = cls({"enableRateLimit": True, "timeout": int(settings.market_http_timeout_seconds * 1000)})
        self._client = client
        return client

    def get_instruments(self) -> Sequence[ProviderInstrument]:
        tfs = tuple(CCXT_TIMEFRAME.keys())
        out = []
        for display in DEFAULT_MARKETS:
            key = normalize_symbol(display)
            spec = INSTRUMENTS.get(key)
            out.append(
                ProviderInstrument(
                    symbol=key,
                    display_symbol=display,
                    asset_class=AssetClass.CRYPTO.value,
                    provider=self.name,
                    timeframes=tfs,
                    quote_currency=spec.quote_currency if spec else "USDT",
                    base_currency=spec.base_currency if spec else display.split("/")[0],
                )
            )
        return out

    def supported_timeframes(self, symbol: str) -> Sequence[str]:
        try:
            markets = self._ex().timeframes or {}
        except Exception:
            return tuple(CCXT_TIMEFRAME.keys())
        if not markets:
            return tuple(CCXT_TIMEFRAME.keys())
        supported = []
        for tf, ccxt_tf in CCXT_TIMEFRAME.items():
            if ccxt_tf in markets:
                supported.append(tf)
        return tuple(supported) or tuple(CCXT_TIMEFRAME.keys())

    def get_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 500,
    ) -> list[Candle]:
        tf = require_timeframe(timeframe, list(CCXT_TIMEFRAME.keys()), self.name)
        supported = self.supported_timeframes(symbol)
        if tf not in supported:
            require_timeframe(tf, supported, self.name)
        market = to_ccxt_symbol(symbol)
        key = normalize_symbol(symbol)
        since = int(start.timestamp() * 1000) if start else None
        t0 = time.perf_counter()
        try:
            rows = self._ex().fetch_ohlcv(market, CCXT_TIMEFRAME[tf], since=since, limit=min(limit, 1000))
        except Exception as exc:
            log_fetch(self.name, symbol, tf, ok=False, ms=(time.perf_counter() - t0) * 1000)
            raise ProviderUnavailable("Market data temporarily unavailable.") from exc
        log_fetch(self.name, symbol, tf, ok=True, ms=(time.perf_counter() - t0) * 1000, extra=f"n={len(rows or [])}")
        candles: list[Candle] = []
        end_ms = int(end.timestamp() * 1000) if end else None
        for row in rows or []:
            if not row or len(row) < 5:
                continue
            ts = int(row[0])
            if end_ms is not None and ts > end_ms:
                continue
            try:
                candles.append(
                    candle(
                        symbol=key,
                        provider=self.name,
                        timeframe=tf,
                        timestamp=parse_utc_ms(ts),
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
        market = to_ccxt_symbol(symbol)
        key = normalize_symbol(symbol)
        t0 = time.perf_counter()
        try:
            ticker = self._ex().fetch_ticker(market)
        except Exception as exc:
            log_fetch(self.name, symbol, "tick", ok=False, ms=(time.perf_counter() - t0) * 1000)
            raise ProviderUnavailable("Market data temporarily unavailable.") from exc
        log_fetch(self.name, symbol, "tick", ok=True, ms=(time.perf_counter() - t0) * 1000)
        last = ticker.get("last") or ticker.get("close")
        ts = ticker.get("timestamp")
        when = parse_utc_ms(ts) if ts else datetime.now(timezone.utc)
        return make_quote(
            symbol=key,
            provider=self.name,
            timestamp=when,
            last=last,
            bid=ticker.get("bid"),
            ask=ticker.get("ask"),
            freshness=DataFreshness.DELAYED.value,
        )


def crypto_providers() -> list[CcxtProvider]:
    return [CcxtProvider(name) for name in _exchange_names()]
