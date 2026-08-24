"""Calculator orchestration: conversion + pure engine + account policy. No LLM math."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConversionUnavailable, DomainError, NotFoundError
from app.core.time import utcnow
from app.engines.calculator import CalcMode, CalculatorInput, calculate
from app.engines.calculator.policy import PolicyLimits, assess_policy
from app.engines.fx_math import INSTRUMENTS, UnknownSymbolError, get_instrument, normalize_symbol
from app.engines.risk_engine import compute_risk_snapshot
from app.market_data.service import conversion_rate, get_quote
from app.models.user import User
from app.schemas.calculator import CalculatorCalculateIn
from app.ai.context import load_account_trades
from app.services.access import get_owned_account
from app.services.mapping import profile_view, trade_to_closed


def list_calculator_instruments() -> list[dict]:
    out = []
    for spec in INSTRUMENTS.values():
        out.append(
            {
                "symbol": spec.symbol,
                "display_symbol": spec.display_symbol or spec.symbol,
                "asset_class": spec.asset_class,
                "base_currency": spec.base_currency,
                "quote_currency": spec.quote_currency,
                "contract_size": str(spec.contract_size),
                "pip_size": str(spec.pip_size),
                "tick_size": str(spec.tick_size or spec.pip_size),
                "quantity_min": str(spec.volume_min),
                "quantity_max": str(spec.volume_max),
                "quantity_step": str(spec.volume_step),
                "price_precision": spec.price_decimals,
                "quantity_precision": spec.volume_precision,
                "size_unit": spec.size_unit,
            }
        )
    return out


def get_calculator_instrument(symbol: str) -> dict:
    try:
        spec = get_instrument(symbol)
    except UnknownSymbolError as exc:
        raise NotFoundError(str(exc)) from exc
    return next(i for i in list_calculator_instruments() if i["symbol"] == spec.symbol)


def account_context(db: Session, user: User, account_id: UUID) -> dict:
    account = get_owned_account(db, user.id, account_id)
    if account.risk_profile is None:
        raise DomainError("Account has no risk profile configured.")
    trades = [trade_to_closed(t) for t in load_account_trades(db, user.id, account.id)]
    profile = profile_view(account.risk_profile)
    snap = compute_risk_snapshot(
        starting_balance=Decimal(account.starting_balance),
        profile=profile,
        trades=trades,
        now=utcnow(),
        timezone=user.timezone,
    )
    return {
        "account_id": str(account.id),
        "account_name": account.account_name,
        "firm": account.firm,
        "program": account.program,
        "currency": account.currency,
        "balance": str(Decimal(account.starting_balance)),
        "equity": str(Decimal(account.current_equity or account.starting_balance)),
        "risk_per_trade": str(profile.risk_per_trade),
        "hard_risk_per_trade": str(profile.hard_risk_per_trade) if profile.hard_risk_per_trade else None,
        "preferred_min_rr": str(profile.preferred_min_rr),
        "personal_daily_loss_limit": str(profile.personal_daily_loss_limit),
        "personal_max_drawdown": str(profile.personal_max_drawdown),
        "max_trades_per_day": profile.max_trades_per_day,
        "snapshot": {
            "status": snap.status.value,
            "daily_pnl": str(snap.daily_pnl),
            "daily_risk": str(snap.daily_risk),
            "trades_today": snap.trades_today,
            "distance_to_personal_daily_loss": str(snap.distance_to_personal_daily_loss),
            "distance_to_personal_max_dd": str(snap.distance_to_personal_max_dd),
            "distance_to_firm_max_dd": str(snap.distance_to_firm_max_dd),
        },
    }


def run_calculate(db: Session, user: User, payload: CalculatorCalculateIn) -> dict:
    account = get_owned_account(db, user.id, payload.account_id)
    if account.risk_profile is None:
        raise DomainError("Account has no risk profile configured.")

    symbol = normalize_symbol(payload.symbol)
    try:
        get_instrument(symbol)
    except UnknownSymbolError as exc:
        raise DomainError(str(exc)) from exc

    if payload.quote_to_account_rate is not None:
        rate = payload.quote_to_account_rate
        conv = {
            "rate": str(rate),
            "base": get_instrument(symbol).quote_currency,
            "quote": account.currency.upper(),
            "source": "client",
            "timestamp": utcnow().isoformat().replace("+00:00", "Z"),
            "cached": False,
            "freshness": "fresh",
            "age_seconds": 0,
            "assumed": False,
            "reason": "Client-supplied conversion rate.",
            "pair": None,
            "quote_currency": get_instrument(symbol).quote_currency,
            "account_currency": account.currency.upper(),
            "quote_price": None,
            "stale_blocked": False,
            "market": None,
            "fx_provider": "client",
        }
        market = None
    else:
        conv = conversion_rate(
            db,
            symbol,
            account.currency,
            allow_stale=payload.allow_stale_conversion,
        )
        if conv.get("stale_blocked"):
            raise ConversionUnavailable(conv["reason"] or "Live conversion rate unavailable.")
        if conv["rate"] is None:
            raise ConversionUnavailable(conv["reason"] or "Conversion rate required.")
        # Normalize Decimal rates that may still be Decimal from older paths
        rate = Decimal(str(conv["rate"]))
        if not isinstance(conv["rate"], str):
            conv = {**conv, "rate": str(rate)}
        market = conv.get("market")

    balance = Decimal(account.current_equity or account.starting_balance)
    result = calculate(
        CalculatorInput(
            mode=CalcMode(payload.mode.value),
            symbol=symbol,
            direction=payload.direction,
            entry=payload.entry,
            account_balance=balance,
            quote_to_account_rate=rate,
            lot_size=payload.lot_size,
            stop_loss=payload.stop_loss,
            take_profit=payload.take_profit,
            risk_amount=payload.risk_amount,
            reward_amount=payload.reward_amount,
            risk_percent=payload.risk_percent,
        )
    )

    trades = [trade_to_closed(t) for t in load_account_trades(db, user.id, account.id)]
    profile = profile_view(account.risk_profile)
    snap = compute_risk_snapshot(
        starting_balance=Decimal(account.starting_balance),
        profile=profile,
        trades=trades,
        now=utcnow(),
        timezone=user.timezone,
    )
    policy = None
    if result.ok:
        policy = assess_policy(
            limits=PolicyLimits(
                risk_per_trade=profile.risk_per_trade,
                hard_risk_per_trade=profile.hard_risk_per_trade,
                preferred_min_rr=profile.preferred_min_rr,
                personal_daily_loss_limit=profile.personal_daily_loss_limit,
                daily_risk_used=snap.daily_risk,
                daily_pnl=snap.daily_pnl,
                equity=Decimal(account.current_equity or account.starting_balance),
                balance=Decimal(account.starting_balance),
                distance_to_personal_daily_loss=snap.distance_to_personal_daily_loss,
                distance_to_personal_max_dd=snap.distance_to_personal_max_dd,
                distance_to_firm_max_dd=snap.distance_to_firm_max_dd,
                snapshot_status=snap.status.value,
            ),
            risk_amount=result.risk_amount,
            reward_amount=result.reward_amount,
            risk_percent=result.risk_percent,
            planned_rr=result.planned_rr,
        ).to_dict()

    # Optional reference quote even when conversion not required (EURUSD)
    if market is None:
        try:
            market = get_quote(db, symbol, allow_stale=True)
        except Exception:
            market = None

    return {
        "calculation": result.to_dict(),
        "policy": policy,
        "conversion": conv,
        "market": market,
        "enforcement_note": (
            "Calculator never encourages overriding RED policy status. "
            "Journal submission still applies account risk enforcement."
        ),
    }
