"""Quant Lab orchestrator."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.core.enums import TradeStatus
from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.fx_math import ZERO, money
from app.engines.quant_lab.behavioral_quant import build_behavior_quant
from app.engines.quant_lab.edge_confidence import build_edge_confidence
from app.engines.quant_lab.bootstrap import bootstrap_expectancy
from app.engines.quant_lab.confidence import wilson_ci
from app.engines.quant_lab.data_quality import filter_valid, validate_quant_trades
from app.engines.quant_lab.distribution import build_distribution
from app.engines.quant_lab.drawdown import build_drawdown
from app.engines.quant_lab.edge_stability import build_edge_stability
from app.engines.quant_lab.expectancy import build_expectancy
from app.engines.quant_lab.monte_carlo import simulation_preview
from app.engines.quant_lab.outliers import build_outlier_dependency
from app.engines.quant_lab.payoff import build_payoff
from app.engines.quant_lab.recovery import recovery_factor
from app.engines.quant_lab.returns import r_returns
from app.engines.quant_lab.research_opportunities import build_research_section
from app.engines.quant_lab.robustness import build_bootstrap_robustness, build_top_trade_removal
from app.engines.quant_lab.walk_forward import build_walk_forward
from app.engines.quant_lab.rolling import build_rolling
from app.engines.quant_lab.sample_policy import sample_payload
from app.engines.quant_lab.streaks import build_quant_streaks
from app.engines.quant_lab.ulcer import ulcer_index, ulcer_index_r
from app.engines.risk_engine import ClosedTrade, build_equity_curve


def _meta(n: int, *, filtered_trades: int, date_range: dict | None, account_name: str | None, starting: Decimal | None = None) -> dict:
    return {
        "filtered_trades": filtered_trades,
        "valid_trades": n,
        "date_range": date_range,
        "account_name": account_name,
        "starting_balance": money(starting) if starting is not None else None,
    }


def build_quant_lab(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    date_range: dict | None = None,
    account_name: str | None = None,
    configured_risk: Decimal | None = None,
) -> dict:
    data_quality = validate_quant_trades(trades)
    valid = filter_valid(trades)
    n = len(valid)
    sample = sample_payload(n)

    expectancy = build_expectancy(valid)
    payoff = build_payoff(valid)
    wins = sum(1 for t in valid if t.classify_outcome() == "win")
    win_ci = wilson_ci(wins, n)

    rs = r_returns(valid)
    bootstrap = bootstrap_expectancy(rs) if rs else bootstrap_expectancy([])

    drawdown = build_drawdown(valid, starting=starting)
    closed_views = [
        ClosedTrade(
            id=t.id,
            entry_at=t.entry_at,
            exit_at=t.exit_at,
            risk_amount=t.risk_amount,
            realized_pnl=t.net_pnl,
            result=t.result,
            status=TradeStatus.CLOSED,
        )
        for t in valid
    ]
    curve = build_equity_curve(starting, closed_views)
    ulcer = ulcer_index(curve)
    ulcer_r = ulcer_index_r(drawdown["r_multiple"]["curve"])
    net = sum((t.net_pnl for t in valid), ZERO)
    rec_currency = recovery_factor(net, drawdown["currency"]["max_drawdown"])
    rec_r = recovery_factor(
        sum(rs, ZERO) if rs else ZERO,
        drawdown["r_multiple"]["max_drawdown_r"],
    )

    rolling = build_rolling(valid)
    streaks = build_quant_streaks(valid, starting=starting)
    stability = build_edge_stability(valid)

    distribution = build_distribution(valid)
    outliers = build_outlier_dependency(valid)
    top_trade_removal = build_top_trade_removal(valid)
    bootstrap_robustness = build_bootstrap_robustness(valid)
    sim_preview = simulation_preview(len(rs) if rs else n)
    behavior = build_behavior_quant(valid, starting=starting, configured_risk=configured_risk)
    edge_confidence = build_edge_confidence(
        sample_size=n,
        expectancy_r=expectancy["expectancy_r"],
        edge_stability=stability,
        outliers=outliers,
        drawdown=drawdown,
        top_trade_removal=top_trade_removal,
    )
    walk_forward = build_walk_forward(valid, starting=starting)
    research = build_research_section(
        sample_size=n,
        expectancy_r=expectancy["expectancy_r"],
        edge_stability=stability,
        outliers=outliers,
        behavior=behavior,
        setup_interactions=behavior["setup_interactions"],
        edge_confidence=edge_confidence,
    )

    overview = {
        "edge_status": {
            "observed_expectancy_r": expectancy["expectancy_r"],
            "recent_expectancy_r": stability["recent"]["expectancy_r"],
            "sample": sample,
            "max_drawdown_r": drawdown["r_multiple"]["max_drawdown_r"],
            "max_drawdown_currency": drawdown["currency"]["max_drawdown"],
            "outlier_dependency_pct": outliers["profit_dependency_top_5_pct"],
            "outlier_dependency_level": outliers["dependency_level"],
            "monte_carlo_status": sim_preview["status"],
        },
        "expectancy_summary": expectancy,
        "data_quality": data_quality,
        "sample_policy": sample,
    }

    return {
        "meta": _meta(n, filtered_trades=len(trades), date_range=date_range, account_name=account_name, starting=starting),
        "overview": overview,
        "edge": {
            "expectancy": expectancy,
            "payoff": payoff,
            "win_rate_ci": win_ci,
            "bootstrap_expectancy_r": bootstrap,
            "edge_stability": stability,
        },
        "drawdown": {
            **drawdown,
            "ulcer_index": ulcer,
            "ulcer_index_r": ulcer_r,
            "recovery_factor_currency": rec_currency,
            "recovery_factor_r": rec_r,
        },
        "rolling": rolling,
        "streaks": streaks,
        "distribution": distribution,
        "outliers": outliers,
        "robustness": {
            "top_trade_removal": top_trade_removal,
            "bootstrap": bootstrap_robustness,
        },
        "simulation": sim_preview,
        "behavior": behavior,
        "edge_confidence": edge_confidence,
        "walk_forward": walk_forward,
        "research": research,
        "disclaimer": (
            "Quant Lab quantifies historical performance and uncertainty. "
            "Results are descriptive — not predictive."
        ),
    }


def build_quant_overview(trades: Sequence[AnalyticsTrade], *, starting: Decimal, **kwargs) -> dict:
    lab = build_quant_lab(trades, starting=starting, **kwargs)
    return lab["overview"] | {"meta": lab["meta"]}


def build_quant_edge(trades: Sequence[AnalyticsTrade], *, starting: Decimal, **kwargs) -> dict:
    lab = build_quant_lab(trades, starting=starting, **kwargs)
    return {"meta": lab["meta"], "edge": lab["edge"], "data_quality": lab["overview"]["data_quality"]}


def build_quant_drawdown(trades: Sequence[AnalyticsTrade], *, starting: Decimal, **kwargs) -> dict:
    lab = build_quant_lab(trades, starting=starting, **kwargs)
    return {
        "meta": lab["meta"],
        "drawdown": lab["drawdown"],
        "streaks": lab["streaks"],
        "data_quality": lab["overview"]["data_quality"],
    }


def build_quant_rolling(trades: Sequence[AnalyticsTrade], *, starting: Decimal, **kwargs) -> dict:
    lab = build_quant_lab(trades, starting=starting, **kwargs)
    return {"meta": lab["meta"], "rolling": lab["rolling"], "data_quality": lab["overview"]["data_quality"]}


def build_quant_distribution(trades: Sequence[AnalyticsTrade], *, starting: Decimal, **kwargs) -> dict:
    lab = build_quant_lab(trades, starting=starting, **kwargs)
    return {"meta": lab["meta"], "distribution": lab["distribution"], "data_quality": lab["overview"]["data_quality"]}


def build_quant_outliers(trades: Sequence[AnalyticsTrade], *, starting: Decimal, **kwargs) -> dict:
    lab = build_quant_lab(trades, starting=starting, **kwargs)
    return {
        "meta": lab["meta"],
        "outliers": lab["outliers"],
        "data_quality": lab["overview"]["data_quality"],
    }


def build_quant_robustness(trades: Sequence[AnalyticsTrade], *, starting: Decimal, **kwargs) -> dict:
    lab = build_quant_lab(trades, starting=starting, **kwargs)
    return {
        "meta": lab["meta"],
        "robustness": lab["robustness"],
        "outliers": lab["outliers"],
        "distribution": lab["distribution"],
        "data_quality": lab["overview"]["data_quality"],
    }


def build_quant_simulation(trades: Sequence[AnalyticsTrade], *, starting: Decimal, **kwargs) -> dict:
    lab = build_quant_lab(trades, starting=starting, **kwargs)
    return {
        "meta": lab["meta"],
        "simulation": lab["simulation"],
        "data_quality": lab["overview"]["data_quality"],
    }


def build_quant_behavior(trades: Sequence[AnalyticsTrade], *, starting: Decimal, **kwargs) -> dict:
    lab = build_quant_lab(trades, starting=starting, **kwargs)
    return {
        "meta": lab["meta"],
        "behavior": lab["behavior"],
        "data_quality": lab["overview"]["data_quality"],
    }


def build_quant_research(trades: Sequence[AnalyticsTrade], *, starting: Decimal, **kwargs) -> dict:
    lab = build_quant_lab(trades, starting=starting, **kwargs)
    return {
        "meta": lab["meta"],
        "research": lab["research"],
        "edge_confidence": lab["edge_confidence"],
        "walk_forward": lab["walk_forward"],
        "data_quality": lab["overview"]["data_quality"],
    }


def build_quant_walk_forward(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    split_ratio: float = 0.7,
    training_from=None,
    training_to=None,
    validation_from=None,
    validation_to=None,
    **kwargs,
) -> dict:
    from app.engines.quant_lab.data_quality import filter_valid

    data_quality = validate_quant_trades(trades)
    valid = filter_valid(trades)
    walk_forward = build_walk_forward(
        valid,
        starting=starting,
        split_ratio=split_ratio,
        training_from=training_from,
        training_to=training_to,
        validation_from=validation_from,
        validation_to=validation_to,
    )
    return {
        "meta": _meta(len(valid), filtered_trades=len(trades), date_range=kwargs.get("date_range"), account_name=kwargs.get("account_name"), starting=starting),
        "walk_forward": walk_forward,
        "data_quality": data_quality,
    }
