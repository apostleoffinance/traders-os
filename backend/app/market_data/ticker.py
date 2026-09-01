"""Market Pulse — batched normalized quotes with change, cache, and single-flight refresh."""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import AssetClass
from app.core.exceptions import DomainError, ProviderUnavailable
from app.core.time import utcnow
from app.engines.fx_math import INSTRUMENTS, get_instrument, normalize_symbol
from app.market_data import service as market_service
from app.market_data.providers.ccxt import crypto_providers, to_ccxt_symbol

log = logging.getLogger("traderos.market")

TICKER_SYMBOLS: tuple[str, ...] = tuple(INSTRUMENTS.keys())

_lock = threading.Lock()
_cache_payload: dict[str, Any] | None = None
_cache_at: datetime | None = None
_refresh_lock = threading.Lock()


@dataclass(frozen=True)
class ChangeBasis:
    reference: Decimal
    label: str


def _freshness_limit(asset_class: str) -> int:
    if asset_class == AssetClass.CRYPTO.value:
        return settings.market_ticker_fresh_crypto_seconds
    return settings.market_ticker_fresh_forex_seconds


def _parse_decimal(value: str | float | int | Decimal | None) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _direction(change: Decimal | None) -> str:
    if change is None:
        return "flat"
    if change > 0:
        return "up"
    if change < 0:
        return "down"
    return "flat"


def _crypto_session_open(symbol: str) -> Decimal | None:
    """CCXT session open — reference for crypto change (not labeled as 24h in API)."""
    market = to_ccxt_symbol(symbol)
    for provider in crypto_providers():
        try:
            ticker = provider._ex().fetch_ticker(market)
            open_ = ticker.get("open")
            if open_ is not None:
                return _parse_decimal(open_)
            percentage = ticker.get("percentage")
            last = ticker.get("last") or ticker.get("close")
            if percentage is not None and last is not None:
                pct = _parse_decimal(percentage)
                price = _parse_decimal(last)
                if pct is not None and price is not None and pct != 0:
                    denom = Decimal("1") + pct / Decimal("100")
                    if denom != 0:
                        return price / denom
        except Exception as exc:
            log.info(
                "ticker crypto reference provider=%s symbol=%s err=%s",
                provider.name,
                symbol,
                type(exc).__name__,
            )
            continue
    return None


def _daily_reference(db: Session, symbol: str) -> ChangeBasis | None:
    try:
        bundle = market_service.get_ohlcv(db, symbol, "D1", limit=2)
        candles = bundle.get("candles") or []
        if len(candles) >= 2:
            ref = _parse_decimal(candles[-2].get("close"))
            if ref is not None and ref > 0:
                return ChangeBasis(reference=ref, label="previous_daily_close")
        if len(candles) == 1:
            ref = _parse_decimal(candles[0].get("open"))
            if ref is not None and ref > 0:
                return ChangeBasis(reference=ref, label="daily_open")
    except (DomainError, ProviderUnavailable, Exception) as exc:
        log.info("ticker daily reference symbol=%s err=%s", symbol, type(exc).__name__)
    return None


def _change_basis(db: Session, symbol: str, asset_class: str) -> ChangeBasis | None:
    if asset_class == AssetClass.CRYPTO.value:
        open_ = _crypto_session_open(symbol)
        if open_ is not None and open_ > 0:
            return ChangeBasis(reference=open_, label="session_open")
    return _daily_reference(db, symbol)


def _compute_change(price: Decimal, basis: ChangeBasis | None) -> tuple[Decimal | None, Decimal | None, str]:
    if basis is None or basis.reference <= 0:
        return None, None, "none"
    change = price - basis.reference
    change_pct = (change / basis.reference) * Decimal("100")
    return change, change_pct.quantize(Decimal("0.01")), basis.label


def _quote_row(db: Session, symbol: str) -> dict[str, Any]:
    key = normalize_symbol(symbol)
    try:
        spec = get_instrument(key)
    except Exception:
        return {
            "symbol": key,
            "display_symbol": key,
            "asset_class": "unknown",
            "status": "unavailable",
        }

    display = spec.display_symbol or spec.symbol
    try:
        raw = market_service.get_quote(db, key, allow_stale=True)
    except Exception as exc:
        log.info("ticker quote unavailable symbol=%s err=%s", key, type(exc).__name__)
        return {
            "symbol": key,
            "display_symbol": display,
            "asset_class": spec.asset_class,
            "status": "unavailable",
        }

    price = _parse_decimal(raw.get("last"))
    if price is None or price <= 0:
        return {
            "symbol": key,
            "display_symbol": display,
            "asset_class": spec.asset_class,
            "status": "unavailable",
        }

    basis = _change_basis(db, key, spec.asset_class)
    change, change_percent, change_label = _compute_change(price, basis)
    age = raw.get("age_seconds")
    freshness = str(raw.get("freshness") or "none")
    limit = _freshness_limit(spec.asset_class)
    is_stale = bool(raw.get("cached")) or freshness == "stale" or (age is not None and age > limit)
    status = "stale" if is_stale else "ok"

    return {
        "symbol": key,
        "display_symbol": display,
        "asset_class": spec.asset_class,
        "price": float(price),
        "previous_price": float(basis.reference) if basis else None,
        "change": float(change) if change is not None else None,
        "change_percent": float(change_percent) if change_percent is not None else None,
        "change_basis": change_label,
        "direction": _direction(change),
        "timestamp": raw.get("timestamp"),
        "provider": raw.get("provider"),
        "is_stale": is_stale,
        "status": status,
        "freshness": freshness,
        "age_seconds": age,
        "warning": raw.get("warning"),
    }


def _refresh(db: Session, symbols: list[str]) -> dict[str, Any]:
    t0 = time.perf_counter()
    quotes = [_quote_row(db, sym) for sym in symbols]
    ok = sum(1 for q in quotes if q.get("status") != "unavailable")
    latency_ms = int((time.perf_counter() - t0) * 1000)
    log.info(
        "market_ticker_refresh symbols=%s ok=%s latency_ms=%s cache=miss",
        len(symbols),
        ok,
        latency_ms,
    )
    return {
        "updated_at": utcnow().isoformat().replace("+00:00", "Z"),
        "quotes": quotes,
    }


def _filter_payload(payload: dict[str, Any], symbols: list[str]) -> dict[str, Any]:
    want = set(symbols)
    quotes = [q for q in payload.get("quotes", []) if q.get("symbol") in want]
    order = {s: i for i, s in enumerate(symbols)}
    quotes.sort(key=lambda q: order.get(q.get("symbol", ""), 999))
    return {"updated_at": payload.get("updated_at"), "quotes": quotes}


def get_ticker(db: Session, symbols: list[str] | None = None) -> dict[str, Any]:
    """Return batched ticker quotes with in-process cache and single-flight refresh."""
    global _cache_payload, _cache_at

    requested = [normalize_symbol(s) for s in (symbols or list(TICKER_SYMBOLS))]
    requested = [s for s in requested if s in INSTRUMENTS]
    if not requested:
        requested = list(TICKER_SYMBOLS)

    ttl = settings.market_ticker_cache_ttl_seconds
    now = utcnow()

    with _lock:
        if _cache_payload is not None and _cache_at is not None:
            age = (now - _cache_at).total_seconds()
            if age <= ttl:
                log.info("market_ticker cache=hit age=%.1fs symbols=%s", age, len(requested))
                return _filter_payload(_cache_payload, requested)

    acquired = _refresh_lock.acquire(blocking=False)
    if not acquired:
        with _lock:
            if _cache_payload is not None:
                log.info("market_ticker cache=stale_wait symbols=%s", len(requested))
                return _filter_payload(_cache_payload, requested)
        _refresh_lock.acquire()
        acquired = True

    try:
        with _lock:
            if _cache_payload is not None and _cache_at is not None:
                age = (utcnow() - _cache_at).total_seconds()
                if age <= ttl:
                    return _filter_payload(_cache_payload, requested)

        payload = _refresh(db, list(TICKER_SYMBOLS))
        with _lock:
            _cache_payload = payload
            _cache_at = utcnow()
        return _filter_payload(payload, requested)
    finally:
        if acquired:
            _refresh_lock.release()


def market_status() -> dict[str, Any]:
    from app.market_data.providers.router import fx_chain

    providers: dict[str, dict[str, str]] = {}
    for p in fx_chain():
        providers[p.name] = {"status": "healthy" if p.enabled() else "disabled"}
    for p in crypto_providers():
        providers[p.name] = {"status": "healthy" if p.enabled() else "disabled"}

    with _lock:
        last = _cache_at.isoformat().replace("+00:00", "Z") if _cache_at else None
        quote_count = len((_cache_payload or {}).get("quotes") or [])

    return {
        "providers": providers,
        "last_refresh": last,
        "cached_quotes": quote_count,
        "ticker_symbols": list(TICKER_SYMBOLS),
        "cache_ttl_seconds": settings.market_ticker_cache_ttl_seconds,
    }


def clear_ticker_cache() -> None:
    global _cache_payload, _cache_at
    with _lock:
        _cache_payload = None
        _cache_at = None
