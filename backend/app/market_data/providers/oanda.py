"""Optional OANDA v20 candles. Disabled when OANDA_API_KEY is empty."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Sequence

from app.core.config import settings
from app.core.enums import AssetClass, DataFreshness, Timeframe
from app.core.exceptions import ProviderUnavailable
from app.engines.fx_math import INSTRUMENTS, normalize_symbol
from app.market_data.normalization import candle, parse_utc, quote as make_quote
from app.market_data.providers.base import http_client, log_fetch, require_timeframe
from app.market_data.schemas import Candle, ProviderInstrument, Quote

log = logging.getLogger("traderos.market")

NAME = "oanda"

OANDA_GRANULARITY = {
    Timeframe.M1.value: "M1",
    Timeframe.M5.value: "M5",
    Timeframe.M15.value: "M15",
    Timeframe.M30.value: "M30",
    Timeframe.H1.value: "H1",
    Timeframe.H4.value: "H4",
    Timeframe.D1.value: "D",
}

OANDA_IDS = {
    "EURUSD": "EUR_USD",
    "GBPUSD": "GBP_USD",
    "USDJPY": "USD_JPY",
    "AUDUSD": "AUD_USD",
    "NZDUSD": "NZD_USD",
    "USDCAD": "USD_CAD",
    "USDCHF": "USD_CHF",
    "XAUUSD": "XAU_USD",
}


def _host() -> str:
    env = (settings.oanda_environment or "practice").lower()
    if env in {"live", "trade", "fxtrade"}:
        return "https://api-fxtrade.oanda.com"
    return "https://api-fxpractice.oanda.com"


class OandaProvider:
    name = NAME
    asset_classes = (AssetClass.FX.value, AssetClass.COMMODITY.value)

    def enabled(self) -> bool:
        return bool(settings.oanda_api_key.strip())

    def get_instruments(self) -> Sequence[ProviderInstrument]:
        if not self.enabled():
            return []
        tfs = tuple(OANDA_GRANULARITY.keys())
        out = []
        for key, oid in OANDA_IDS.items():
            spec = INSTRUMENTS.get(key)
            out.append(
                ProviderInstrument(
                    symbol=key,
                    display_symbol=oid.replace("_", "/"),
                    asset_class=spec.asset_class if spec else AssetClass.FX.value,
                    provider=NAME,
                    timeframes=tfs,
                    quote_currency=spec.quote_currency if spec else "USD",
                    base_currency=spec.base_currency if spec else key[:3],
                )
            )
        return out

    def supported_timeframes(self, symbol: str) -> Sequence[str]:
        if normalize_symbol(symbol) not in OANDA_IDS:
            return ()
        return tuple(OANDA_GRANULARITY.keys())

    def get_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 500,
    ) -> list[Candle]:
        if not self.enabled():
            raise ProviderUnavailable("OANDA is not configured.")
        key = normalize_symbol(symbol)
        oid = OANDA_IDS.get(key)
        if oid is None:
            raise ProviderUnavailable(f"OANDA does not list {symbol}.")
        tf = require_timeframe(timeframe, self.supported_timeframes(symbol), NAME)
        params: dict[str, str] = {
            "granularity": OANDA_GRANULARITY[tf],
            "price": "M",
            "count": str(min(max(limit, 1), 5000)),
        }
        if start is not None:
            params["from"] = start.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            params.pop("count", None)
        if end is not None:
            params["to"] = end.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        t0 = time.perf_counter()
        try:
            payload = self._get(f"/v3/instruments/{oid}/candles", params)
        except Exception as exc:
            log_fetch(NAME, symbol, tf, ok=False, ms=(time.perf_counter() - t0) * 1000)
            raise ProviderUnavailable("Market data temporarily unavailable.") from exc
        log_fetch(NAME, symbol, tf, ok=True, ms=(time.perf_counter() - t0) * 1000)
        candles: list[Candle] = []
        for row in payload.get("candles") or []:
            mid = row.get("mid") or {}
            if not mid or not row.get("time"):
                continue
            try:
                candles.append(
                    candle(
                        symbol=key,
                        provider=NAME,
                        timeframe=tf,
                        timestamp=parse_utc(row["time"]),
                        open_=mid.get("o"),
                        high=mid.get("h"),
                        low=mid.get("l"),
                        close=mid.get("c"),
                        volume=row.get("volume"),
                    )
                )
            except (ValueError, TypeError, KeyError):
                continue
        candles.sort(key=lambda c: c.timestamp)
        return candles[-limit:]

    def get_quote(self, symbol: str) -> Quote:
        bars = self.get_ohlcv(symbol, Timeframe.M1.value, limit=1)
        if not bars:
            raise ProviderUnavailable("No OANDA quote available.")
        last = bars[-1]
        return make_quote(
            symbol=last.symbol,
            provider=NAME,
            timestamp=last.timestamp,
            last=last.close,
            freshness=DataFreshness.DELAYED.value,
        )

    def _get(self, path: str, params: dict[str, str]) -> dict:
        headers = {
            "Authorization": f"Bearer {settings.oanda_api_key}",
            "Content-Type": "application/json",
            "Accept-Datetime-Format": "RFC3339",
        }
        with http_client() as client:
            response = client.get(_host() + path, params=params, headers=headers)
            if response.status_code == 429:
                raise ProviderUnavailable("OANDA rate limit reached. Using cache if available.")
            response.raise_for_status()
            return response.json()
