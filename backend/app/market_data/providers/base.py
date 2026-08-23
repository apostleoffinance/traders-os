from __future__ import annotations

import logging
from typing import Sequence

import httpx

from app.core.config import settings
from app.core.exceptions import ProviderUnavailable, UnsupportedTimeframe
from app.engines.fx_math import normalize_symbol
from app.market_data.schemas import MARKET_TIMEFRAMES, ProviderInstrument

log = logging.getLogger("traderos.market")

DEFAULT_TIMEOUT = httpx.Timeout(settings.market_http_timeout_seconds, connect=5.0)


def http_client() -> httpx.Client:
    return httpx.Client(timeout=DEFAULT_TIMEOUT, follow_redirects=True)


def require_timeframe(timeframe: str, supported: Sequence[str], provider: str) -> str:
    tf = timeframe.upper()
    if tf not in supported:
        raise UnsupportedTimeframe(
            f"{timeframe} is not supported by {provider}. Available: {', '.join(supported)}"
        )
    return tf


def log_fetch(provider: str, symbol: str, timeframe: str, *, ok: bool, ms: float, extra: str = "") -> None:
    status = "ok" if ok else "fail"
    log.info(
        "market provider=%s symbol=%s timeframe=%s status=%s duration_ms=%.0f %s",
        provider,
        normalize_symbol(symbol),
        timeframe,
        status,
        ms,
        extra,
    )


__all__ = [
    "ProviderUnavailable",
    "UnsupportedTimeframe",
    "http_client",
    "require_timeframe",
    "log_fetch",
    "MARKET_TIMEFRAMES",
    "ProviderInstrument",
]
