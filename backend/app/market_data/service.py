"""MarketDataService — the only entry point the rest of the app uses."""

from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import DataFreshness
from app.core.exceptions import ProviderUnavailable, UnsupportedTimeframe
from app.core.time import utcnow
from app.engines.fx_math import INSTRUMENTS, get_instrument, normalize_symbol
from app.market_data import cache
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


def get_quote(db: Session, symbol: str) -> dict:
    key = normalize_symbol(symbol)
    last_error: Exception | None = None
    for provider in _try_providers(key):
        try:
            q = provider.get_quote(key)
            return {
                "symbol": q.symbol,
                "provider": q.provider,
                "timestamp": q.timestamp.isoformat().replace("+00:00", "Z"),
                "last": q.last,
                "bid": q.bid,
                "ask": q.ask,
                "freshness": q.freshness,
            }
        except Exception as exc:
            last_error = exc
            cached = cache.load_cached(db, provider=provider.name, symbol=key, timeframe="M1", limit=1)
            if cached:
                last = cached[-1]
                return {
                    "symbol": last.symbol,
                    "provider": last.provider,
                    "timestamp": last.timestamp.isoformat() if hasattr(last.timestamp, "isoformat") else str(last.timestamp),
                    "last": last.close,
                    "bid": None,
                    "ask": None,
                    "freshness": DataFreshness.STALE.value,
                    "warning": "Using cached data — provider temporarily unavailable.",
                }
    raise ProviderUnavailable("Market data temporarily unavailable.") from last_error


def conversion_rate(db: Session, symbol: str, account_currency: str) -> dict:
    spec = get_instrument(symbol)
    price: Decimal | None = None
    if needs_quote_price(spec, account_currency):
        try:
            q = get_quote(db, spec.symbol)
            price = Decimal(str(q["last"]))
        except Exception:
            price = None
    result = conversion_for_account(spec, account_currency, quote_price=price)
    return {
        "rate": result.rate,
        "assumed": result.assumed,
        "reason": result.reason,
        "pair": result.pair,
        "quote_currency": spec.quote_currency,
        "account_currency": account_currency.upper(),
    }


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
