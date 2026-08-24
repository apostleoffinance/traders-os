"""FX conversion rate cache + freshness policy. Never fabricates rates."""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from app.core.config import settings
from app.core.time import as_utc, utcnow

log = logging.getLogger("traderos.market")

# fresh < FX_RATE_FRESH_SECONDS
# recent < FX_RATE_RECENT_SECONDS
# stale >= FX_RATE_RECENT_SECONDS


@dataclass(frozen=True)
class CachedQuote:
    symbol: str
    provider: str
    last: Decimal
    timestamp: datetime
    fetched_at: datetime


_lock = threading.Lock()
_quote_cache: dict[str, CachedQuote] = {}


def classify_age(age_seconds: int | None) -> str:
    if age_seconds is None:
        return "none"
    if age_seconds < settings.fx_rate_fresh_seconds:
        return "fresh"
    if age_seconds < settings.fx_rate_recent_seconds:
        return "recent"
    return "stale"


def cache_put_quote(
    *,
    symbol: str,
    provider: str,
    last: Decimal,
    timestamp: datetime,
) -> CachedQuote:
    key = symbol.upper()
    entry = CachedQuote(
        symbol=key,
        provider=provider,
        last=last,
        timestamp=as_utc(timestamp) if hasattr(timestamp, "tzinfo") else timestamp,
        fetched_at=utcnow(),
    )
    with _lock:
        _quote_cache[key] = entry
    log.info("fx_cache=put symbol=%s provider=%s last=%s", key, provider, last)
    return entry


def cache_get_quote(symbol: str) -> CachedQuote | None:
    with _lock:
        return _quote_cache.get(symbol.upper())


def clear_quote_cache() -> None:
    with _lock:
        _quote_cache.clear()


def age_seconds(ts: datetime | None) -> int | None:
    if ts is None:
        return None
    try:
        return max(0, int((utcnow() - as_utc(ts)).total_seconds()))
    except Exception:
        return None
