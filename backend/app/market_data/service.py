"""MarketDataService — the only entry point the rest of the app uses."""

from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import DataFreshness
from app.core.exceptions import ProviderUnavailable, UnsupportedTimeframe
from app.core.time import as_utc, utcnow
from app.engines.fx_math import INSTRUMENTS, get_instrument, normalize_symbol
from app.market_data import cache
from app.market_data import fx_rates
from app.market_data.conversion import conversion_for_account, needs_quote_price
from app.market_data.providers.router import all_providers, providers_for_symbol

log = logging.getLogger("traderos.market")


def list_instruments() -> list[dict]:
    seen: dict[str, dict] = {}
    for spec in INSTRUMENTS.values():
        seen[spec.symbol] = {
            "symbol": spec.symbol,
            "display_symbol": spec.display_symbol or spec.symbol,
            "asset_class": spec.asset_class,
            "base_currency": spec.base_currency,
            "quote_currency": spec.quote_currency,
            "contract_size": spec.contract_size,
            "pip_size": spec.pip_size,
            "tick_size": spec.tick_size,
            "price_decimals": spec.price_decimals,
            "volume_min": spec.volume_min,
            "volume_step": spec.volume_step,
            "size_unit": spec.size_unit,
            "providers": [],
            "timeframes": [],
        }
    for provider in all_providers():
        if not provider.enabled():
            continue
        try:
            listed = provider.get_instruments()
        except Exception:
            continue
        for item in listed:
            row = seen.setdefault(
                item.symbol,
                {
                    "symbol": item.symbol,
                    "display_symbol": item.display_symbol,
                    "asset_class": item.asset_class,
                    "base_currency": item.base_currency,
                    "quote_currency": item.quote_currency,
                    "contract_size": None,
                    "pip_size": None,
                    "tick_size": None,
                    "price_decimals": 5,
                    "volume_min": None,
                    "volume_step": None,
                    "size_unit": "lots",
                    "providers": [],
                    "timeframes": [],
                },
            )
            if provider.name not in row["providers"]:
                row["providers"].append(provider.name)
            for tf in item.timeframes:
                if tf not in row["timeframes"]:
                    row["timeframes"].append(tf)
    order = list(INSTRUMENTS.keys())
    rest = [k for k in seen if k not in order]
    return [seen[k] for k in order + rest]


def _try_providers(symbol: str) -> list:
    chain = providers_for_symbol(symbol)
    if not chain:
        raise ProviderUnavailable("No market-data provider is available for this instrument.")
    return chain


def get_ohlcv(
    db: Session,
    symbol: str,
    timeframe: str,
    *,
    limit: int | None = None,
) -> dict:
    key = normalize_symbol(symbol)
    limit = min(limit or settings.market_ohlcv_limit, 1500)
    chain = _try_providers(key)
    last_error: Exception | None = None
    for provider in chain:
        pkey = cache.inflight_key(provider.name, key, timeframe)
        lock = cache.acquire_inflight(pkey)
        with lock:
            cached = cache.load_cached(db, provider=provider.name, symbol=key, timeframe=timeframe, limit=limit)
            if cached and cache.is_fresh(cached, timeframe):
                log.info("market cache=hit provider=%s symbol=%s timeframe=%s n=%s", provider.name, key, timeframe, len(cached))
                return _bundle(cached, provider.name, freshness=DataFreshness.DELAYED.value, stale=False)
            try:
                fetched = provider.get_ohlcv(key, timeframe, limit=limit)
                if fetched:
                    cache.persist_candles(db, fetched)
                    db.commit()
                    rows = cache.load_cached(
                        db, provider=provider.name, symbol=key, timeframe=timeframe, limit=limit
                    )
                    log.info("market cache=miss provider=%s symbol=%s timeframe=%s n=%s", provider.name, key, timeframe, len(rows))
                    return _bundle(rows, provider.name, freshness=DataFreshness.DELAYED.value, stale=False)
            except UnsupportedTimeframe:
                raise
            except Exception as exc:
                last_error = exc
                log.info("market provider=%s symbol=%s failed: %s", provider.name, key, type(exc).__name__)
                if cached:
                    db.rollback()
                    return _bundle(
                        cached,
                        provider.name,
                        freshness=DataFreshness.STALE.value,
                        stale=True,
                        warning="Using cached data — provider temporarily unavailable.",
                    )
    if last_error:
        raise ProviderUnavailable("Market data temporarily unavailable.") from last_error
    raise ProviderUnavailable("Market data temporarily unavailable.")


def get_ohlcv_range(
    db: Session,
    symbol: str,
    timeframe: str,
    *,
    start: datetime,
    end: datetime,
    limit: int = 5000,
) -> list:
    """Fetch OHLC candles for a historical window (for MFE/MAE backfill)."""
    from app.market_data.schemas import Candle

    key = normalize_symbol(symbol)
    start_utc = as_utc(start)
    end_utc = as_utc(end)
    if end_utc <= start_utc:
        return []
    limit = min(max(limit, 10), 5000)
    chain = _try_providers(key)
    last_error: Exception | None = None
    for provider in chain:
        try:
            fetched = provider.get_ohlcv(key, timeframe, start=start_utc, end=end_utc, limit=limit)
            if fetched:
                in_range = [c for c in fetched if start_utc <= as_utc(c.timestamp) <= end_utc]
                if in_range:
                    cache.persist_candles(db, in_range)
                    return in_range
        except UnsupportedTimeframe:
            raise
        except Exception as exc:
            last_error = exc
            log.info(
                "market range provider=%s symbol=%s failed: %s",
                provider.name,
                key,
                type(exc).__name__,
            )
    if last_error:
        raise ProviderUnavailable("Market data temporarily unavailable for this period.") from last_error
    return []


def get_quote(db: Session, symbol: str, *, allow_stale: bool = True) -> dict:
    """Fetch latest quote with short-lived in-memory reuse. Never fabricates prices."""
    key = normalize_symbol(symbol)
    cached_mem = fx_rates.cache_get_quote(key)
    if cached_mem is not None:
        age = fx_rates.age_seconds(cached_mem.fetched_at)
        if age is not None and age <= settings.fx_quote_cache_ttl_seconds:
            log.info("market quote cache=hit symbol=%s provider=%s age=%s", key, cached_mem.provider, age)
            return {
                "symbol": cached_mem.symbol,
                "provider": cached_mem.provider,
                "timestamp": cached_mem.timestamp.isoformat().replace("+00:00", "Z"),
                "last": str(cached_mem.last),
                "bid": None,
                "ask": None,
                "freshness": fx_rates.classify_age(fx_rates.age_seconds(cached_mem.timestamp)),
                "cached": True,
                "age_seconds": fx_rates.age_seconds(cached_mem.timestamp),
            }

    last_error: Exception | None = None
    for provider in _try_providers(key):
        try:
            q = provider.get_quote(key)
            fx_rates.cache_put_quote(
                symbol=q.symbol,
                provider=q.provider,
                last=Decimal(str(q.last)),
                timestamp=q.timestamp,
            )
            age = fx_rates.age_seconds(q.timestamp)
            freshness = fx_rates.classify_age(age)
            log.info(
                "market quote cache=miss provider=%s symbol=%s freshness=%s age=%s",
                provider.name,
                key,
                freshness,
                age,
            )
            return {
                "symbol": q.symbol,
                "provider": q.provider,
                "timestamp": q.timestamp.isoformat().replace("+00:00", "Z"),
                "last": str(q.last),
                "bid": str(q.bid) if q.bid is not None else None,
                "ask": str(q.ask) if q.ask is not None else None,
                "freshness": freshness,
                "cached": False,
                "age_seconds": age,
            }
        except Exception as exc:
            last_error = exc
            log.info("market provider=%s symbol=%s quote failed: %s", provider.name, key, type(exc).__name__)
            db_cached = cache.load_cached(db, provider=provider.name, symbol=key, timeframe="M1", limit=1)
            if db_cached:
                last = db_cached[-1]
                ts = last.timestamp
                age = fx_rates.age_seconds(ts if hasattr(ts, "tzinfo") else None)
                freshness = fx_rates.classify_age(age)
                if freshness == "stale" and not allow_stale:
                    continue
                payload = {
                    "symbol": last.symbol,
                    "provider": last.provider,
                    "timestamp": last.timestamp.isoformat() if hasattr(last.timestamp, "isoformat") else str(last.timestamp),
                    "last": str(last.close),
                    "bid": None,
                    "ask": None,
                    "freshness": "stale" if freshness == "stale" else freshness,
                    "cached": True,
                    "age_seconds": age,
                    "warning": "Using cached data — provider temporarily unavailable.",
                }
                fx_rates.cache_put_quote(
                    symbol=last.symbol,
                    provider=last.provider,
                    last=Decimal(str(last.close)),
                    timestamp=as_utc(last.timestamp) if hasattr(last.timestamp, "tzinfo") else utcnow(),
                )
                return payload
    raise ProviderUnavailable("Market data temporarily unavailable.") from last_error


def conversion_rate(
    db: Session,
    symbol: str,
    account_currency: str,
    *,
    allow_stale: bool = False,
) -> dict:
    """Resolve quote→account conversion with provenance. Never fabricates a rate."""
    spec = get_instrument(symbol)
    quote_ccy = spec.quote_currency.upper()
    account = account_currency.upper()
    market: dict | None = None
    price: Decimal | None = None
    source: str | None = None
    timestamp: str | None = None
    cached = False
    age: int | None = None
    freshness = "none"

    if needs_quote_price(spec, account):
        try:
            q = get_quote(db, spec.symbol, allow_stale=True)
            market = {
                "symbol": q["symbol"],
                "last": q["last"],
                "provider": q["provider"],
                "timestamp": q["timestamp"],
                "freshness": q.get("freshness"),
                "cached": q.get("cached", False),
                "age_seconds": q.get("age_seconds"),
                "warning": q.get("warning"),
            }
            age = q.get("age_seconds")
            freshness = fx_rates.classify_age(age) if age is not None else str(q.get("freshness") or "none")
            cached = bool(q.get("cached"))
            source = q.get("provider")
            timestamp = q.get("timestamp")
            if freshness == "stale" and not allow_stale:
                log.info(
                    "fx conversion refused stale symbol=%s age=%s allow_stale=%s",
                    spec.symbol,
                    age,
                    allow_stale,
                )
                return {
                    "rate": None,
                    "base": quote_ccy,
                    "quote": account,
                    "source": source,
                    "timestamp": timestamp,
                    "cached": cached,
                    "freshness": "stale",
                    "age_seconds": age,
                    "assumed": False,
                    "reason": (
                        "Live conversion rate unavailable. Market quote is stale. "
                        "Refresh, or explicitly allow a cached rate."
                    ),
                    "pair": spec.symbol,
                    "quote_currency": quote_ccy,
                    "account_currency": account,
                    "quote_price": q.get("last"),
                    "stale_blocked": True,
                    "market": market,
                }
            price = Decimal(str(q["last"]))
        except Exception as exc:
            log.info("fx conversion quote unavailable symbol=%s err=%s", spec.symbol, type(exc).__name__)
            # Try memory cache only if allow_stale
            mem = fx_rates.cache_get_quote(spec.symbol)
            if mem is not None and allow_stale:
                age = fx_rates.age_seconds(mem.timestamp)
                freshness = fx_rates.classify_age(age)
                price = mem.last
                source = mem.provider
                timestamp = mem.timestamp.isoformat().replace("+00:00", "Z")
                cached = True
                market = {
                    "symbol": mem.symbol,
                    "last": str(mem.last),
                    "provider": mem.provider,
                    "timestamp": timestamp,
                    "freshness": freshness,
                    "cached": True,
                    "age_seconds": age,
                    "warning": "Using cached quote — live provider unavailable.",
                }
            else:
                return {
                    "rate": None,
                    "base": quote_ccy,
                    "quote": account,
                    "source": None,
                    "timestamp": None,
                    "cached": False,
                    "freshness": "none",
                    "age_seconds": None,
                    "assumed": False,
                    "reason": "Live conversion rate unavailable. Market quote could not be retrieved.",
                    "pair": None,
                    "quote_currency": quote_ccy,
                    "account_currency": account,
                    "quote_price": None,
                    "stale_blocked": False,
                    "market": None,
                }

    result = conversion_for_account(spec, account, quote_price=price)
    if result.rate is not None and not needs_quote_price(spec, account):
        freshness = "assumed" if result.assumed else "fresh"
        source = "parity" if result.assumed else "instrument"
        timestamp = utcnow().isoformat().replace("+00:00", "Z")

    out = {
        "rate": str(result.rate) if result.rate is not None else None,
        "base": quote_ccy,
        "quote": account,
        "source": source or ("parity" if result.assumed else None),
        "timestamp": timestamp,
        "cached": cached,
        "freshness": freshness if result.rate is not None else (freshness if freshness != "none" else "none"),
        "age_seconds": age,
        "assumed": result.assumed,
        "reason": result.reason,
        "pair": result.pair,
        "quote_currency": quote_ccy,
        "account_currency": account,
        "quote_price": str(price) if price is not None else None,
        "stale_blocked": False,
        "market": market,
        "fx_provider": settings.fx_provider,
    }
    if result.rate is None and result.reason:
        out["reason"] = result.reason
    log.info(
        "fx conversion symbol=%s account=%s rate=%s source=%s freshness=%s cached=%s",
        spec.symbol,
        account,
        out["rate"],
        out["source"],
        out["freshness"],
        cached,
    )
    return out


def _bundle(rows, provider: str, *, freshness: str, stale: bool, warning: str | None = None) -> dict:
    payload = cache.rows_to_payload(rows)
    last_ts = payload[-1]["timestamp"] if payload else None
    age = None
    if last_ts:
        try:
            last = datetime.fromisoformat(str(last_ts).replace("Z", "+00:00"))
            age = max(0, int((utcnow() - last).total_seconds()))
        except Exception:
            age = None
    label = freshness
    if stale:
        label = DataFreshness.STALE.value
    elif freshness == DataFreshness.DELAYED.value:
        label = DataFreshness.DELAYED.value
    return {
        "provider": provider,
        "freshness": label,
        "stale": stale,
        "warning": warning,
        "updated_seconds_ago": age,
        "candles": payload,
        "count": len(payload),
    }
