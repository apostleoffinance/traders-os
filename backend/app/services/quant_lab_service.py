"""Quant Lab service — loads filtered trades and builds payloads."""

from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.user import User
from app.services.analytics_service import _apply_filters, _trades, resolve_date_window
from app.services.access import get_owned_account
from app.services.mapping import profile_view


def _configured_risk(account) -> Decimal | None:
    if account.risk_profile is None:
        return None
    return profile_view(account.risk_profile).risk_per_trade


def _lab_kwargs(account, date_range) -> dict:
    return {
        "starting": Decimal(account.starting_balance),
        "date_range": date_range,
        "account_name": account.account_name,
        "configured_risk": _configured_risk(account),
    }


def _load_rows(
    db: Session,
    user: User,
    account_id: UUID,
    *,
    preset: str = "all",
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
):
    from app.engines.analytics_lab.trade_row import trade_to_analytics

    account = get_owned_account(db, user.id, account_id)
    all_trades = _trades(db, user.id, account.id)
    start, end, resolved = resolve_date_window(preset, date_from, date_to, user.timezone)
    filtered = _apply_filters(
        all_trades,
        timezone=user.timezone,
        date_from=start,
        date_to=end,
        symbol=symbol,
        session=session,
        setup_id=setup_id,
        direction=direction,
        timeframe=timeframe,
        psychology=psychology,
        result=result,
    )
    rows = [trade_to_analytics(t) for t in filtered]
    date_range = {
        "preset": resolved,
        "from": start.isoformat() if start else None,
        "to": end.isoformat() if end else None,
    }
    return account, rows, date_range


def overview(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_overview

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_overview(rows, **_lab_kwargs(account, date_range))


def edge(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_edge

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_edge(rows, **_lab_kwargs(account, date_range))


def drawdown(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_drawdown

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_drawdown(rows, **_lab_kwargs(account, date_range))


def rolling(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_rolling

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_rolling(rows, **_lab_kwargs(account, date_range))


def full(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_lab

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_lab(rows, **_lab_kwargs(account, date_range))


def distribution(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_distribution

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_distribution(rows, **_lab_kwargs(account, date_range))


def outliers(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_outliers

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_outliers(rows, **_lab_kwargs(account, date_range))


def robustness(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_robustness

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_robustness(rows, **_lab_kwargs(account, date_range))


def bootstrap_analysis(
    db,
    user,
    account_id,
    *,
    iterations: int = 5000,
    seed: int = 42,
    **filters,
) -> dict:
    from app.engines.quant_lab.builder import build_quant_lab
    from app.engines.quant_lab.data_quality import filter_valid
    from app.engines.quant_lab.robustness import build_bootstrap_robustness

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    valid = filter_valid(rows)
    return {
        "meta": {
            "filtered_trades": len(rows),
            "valid_trades": len(valid),
            "date_range": date_range,
            "account_name": account.account_name,
        },
        "bootstrap": build_bootstrap_robustness(valid, iterations=iterations, seed=seed),
    }


def monte_carlo(
    db,
    user,
    account_id,
    *,
    simulations: int = 10_000,
    future_trades: int = 100,
    seed: int = 42,
    unit: str = "R",
    drawdown_threshold: Decimal | None = None,
    **filters,
) -> dict:
    from app.engines.quant_lab.data_quality import filter_valid
    from app.engines.quant_lab.monte_carlo import run_monte_carlo
    from app.engines.quant_lab.returns import r_returns

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    valid = filter_valid(rows)
    rs = r_returns(valid)
    pnls = [t.net_pnl for t in valid]

    if unit == "currency":
        sample = pnls
    else:
        sample = rs

    result = run_monte_carlo(
        sample,
        simulations=simulations,
        future_trades=future_trades,
        seed=seed,
        unit=unit,
        drawdown_threshold=drawdown_threshold,
    )
    return {
        "meta": {
            "filtered_trades": len(rows),
            "valid_trades": len(valid),
            "valid_r_trades": len(rs),
            "date_range": date_range,
            "account_name": account.account_name,
        },
        "monte_carlo": result,
    }


def risk_of_ruin(
    db,
    user,
    account_id,
    *,
    account_equity: Decimal | None = None,
    risk_per_trade_pct: Decimal | None = None,
    ruin_drawdown_pct: Decimal = Decimal("20"),
    simulations: int = 10_000,
    future_trades: int = 200,
    seed: int = 42,
    **filters,
) -> dict:
    from app.engines.quant_lab.data_quality import filter_valid
    from app.engines.quant_lab.risk_of_ruin import estimate_risk_of_ruin
    from app.engines.quant_lab.returns import r_returns

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    valid = filter_valid(rows)
    rs = r_returns(valid)
    equity = account_equity or Decimal(account.starting_balance)
    risk_pct = risk_per_trade_pct or _configured_risk(account)
    if risk_pct is None:
        risk_pct = Decimal("1")

    result = estimate_risk_of_ruin(
        rs,
        account_equity=equity,
        risk_per_trade_pct=risk_pct,
        ruin_drawdown_pct=ruin_drawdown_pct,
        simulations=simulations,
        future_trades=future_trades,
        seed=seed,
    )
    return {
        "meta": {
            "filtered_trades": len(rows),
            "valid_trades": len(valid),
            "valid_r_trades": len(rs),
            "date_range": date_range,
            "account_name": account.account_name,
        },
        "risk_of_ruin": result,
    }


def simulation_preview_endpoint(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_simulation

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_simulation(rows, **_lab_kwargs(account, date_range))


def behavior(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_behavior

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_behavior(rows, **_lab_kwargs(account, date_range))


def research_opportunities(db, user, account_id, **filters) -> dict:
    from app.engines.quant_lab.builder import build_quant_research

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    return build_quant_research(rows, **_lab_kwargs(account, date_range))


def walk_forward(
    db,
    user,
    account_id,
    *,
    split_ratio: float = 0.7,
    training_from: str | None = None,
    training_to: str | None = None,
    validation_from: str | None = None,
    validation_to: str | None = None,
    **filters,
) -> dict:
    from datetime import datetime

    from app.engines.quant_lab.builder import build_quant_walk_forward

    def _parse(value: str | None):
        if not value:
            return None
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    kwargs = _lab_kwargs(account, date_range)
    return build_quant_walk_forward(
        rows,
        split_ratio=split_ratio,
        training_from=_parse(training_from),
        training_to=_parse(training_to),
        validation_from=_parse(validation_from),
        validation_to=_parse(validation_to),
        **kwargs,
    )


def compare_combination(
    db,
    user,
    account_id,
    *,
    setup: str | None = None,
    session: str | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    emotion: str | None = None,
    confirmation: bool | None = None,
    rules_followed: bool | None = None,
    emotional: bool | None = None,
    **filters,
) -> dict:
    from app.engines.quant_lab.behavioral_quant import explore_combination
    from app.engines.quant_lab.data_quality import filter_valid

    account, rows, date_range = _load_rows(db, user, account_id, **filters)
    valid = filter_valid(rows)
    conditions = {
        k: v
        for k, v in {
            "setup": setup,
            "session": session,
            "direction": direction,
            "timeframe": timeframe,
            "emotion": emotion,
            "confirmation": confirmation,
            "rules_followed": rules_followed,
            "emotional": emotional,
        }.items()
        if v is not None
    }
    result = explore_combination(
        valid,
        starting=Decimal(account.starting_balance),
        conditions=conditions,
    )
    return {
        "meta": {
            "filtered_trades": len(rows),
            "valid_trades": len(valid),
            "date_range": date_range,
            "account_name": account.account_name,
        },
        "comparison": result,
    }
