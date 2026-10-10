"""Reproducible historical cohort experiments with explicit cost stress assumptions.

This evaluates already-recorded trades. It is not a candle-level strategy backtest and
must not be presented as evidence that changed entry/exit rules would have filled.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import replace
from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade, ordered_closed
from app.engines.fx_math import ZERO, money, ratio
from app.engines.quant_lab.data_quality import validate_quant_trades, filter_valid
from app.engines.quant_lab.expectancy import build_expectancy
from app.engines.quant_lab.walk_forward import build_walk_forward


def _fingerprint(trades: Sequence[AnalyticsTrade]) -> str:
    rows = []
    for trade in ordered_closed(trades):
        rows.append({
            "id": trade.id,
            "symbol": trade.symbol,
            "direction": trade.direction,
            "entry_at": trade.entry_at.isoformat() if trade.entry_at else None,
            "exit_at": trade.exit_at.isoformat() if trade.exit_at else None,
            "net_pnl": str(trade.net_pnl) if trade.net_pnl is not None else None,
            "risk_amount": str(trade.risk_amount),
            "r_multiple": str(trade.r_multiple) if trade.r_multiple is not None else None,
            "commission": str(trade.commission),
            "swap": str(trade.swap),
        })
    encoded = json.dumps(rows, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _adjusted_rows(
    trades: Sequence[AnalyticsTrade],
    additional_cost_per_trade: Decimal,
) -> list[AnalyticsTrade]:
    adjusted: list[AnalyticsTrade] = []
    for trade in filter_valid(trades):
        adjusted_pnl = trade.net_pnl - additional_cost_per_trade
        adjusted_r = adjusted_pnl / trade.risk_amount if trade.risk_amount > ZERO else None
        adjusted.append(replace(trade, realized_pnl=adjusted_pnl, realized_r=adjusted_r))
    return adjusted


def _profit_factor(trades: Sequence[AnalyticsTrade]) -> Decimal | None:
    gross_profit = sum((trade.net_pnl for trade in trades if trade.net_pnl > ZERO), ZERO)
    gross_loss = abs(sum((trade.net_pnl for trade in trades if trade.net_pnl < ZERO), ZERO))
    if gross_loss == ZERO:
        return None
    return ratio(gross_profit / gross_loss)


def _scenario(trades: Sequence[AnalyticsTrade], *, starting: Decimal, split_ratio: float, extra_cost: Decimal) -> dict:
    adjusted = _adjusted_rows(trades, extra_cost)
    expectancy = build_expectancy(adjusted)
    walk = build_walk_forward(adjusted, starting=starting, split_ratio=split_ratio)
    net_pnl = sum((trade.net_pnl for trade in adjusted), ZERO)
    return {
        "additional_cost_per_trade": money(extra_cost),
        "sample_size": len(adjusted),
        "net_pnl": money(net_pnl),
        "expectancy_r": expectancy["expectancy_r"],
        "win_rate": expectancy["win_rate"],
        "profit_factor": _profit_factor(adjusted),
        "in_sample": walk["in_sample"],
        "out_of_sample": walk["out_of_sample"],
        "out_of_sample_change": walk["differences"],
    }


def build_strategy_experiment(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    split_ratio: float = 0.7,
    additional_cost_per_trade: Decimal = ZERO,
    research_context: dict | None = None,
) -> dict:
    """Build deterministic evidence for a filtered historical cohort."""
    if not 0.5 <= split_ratio < 0.9:
        raise ValueError("split_ratio must be between 0.5 inclusive and 0.9 exclusive.")
    if additional_cost_per_trade < ZERO:
        raise ValueError("additional_cost_per_trade must be zero or greater.")

    quality = validate_quant_trades(trades)
    valid = filter_valid(trades)
    recorded_costs = sum(
        (abs(trade.commission or ZERO) + abs(trade.swap or ZERO) for trade in valid),
        ZERO,
    )
    scenarios = [
        _scenario(valid, starting=starting, split_ratio=split_ratio, extra_cost=additional_cost_per_trade * multiplier)
        for multiplier in (Decimal("0"), Decimal("1"), Decimal("2"))
    ]
    fingerprint = _fingerprint(valid)
    experiment_config = {
        "split_ratio": split_ratio,
        "additional_cost_per_trade": str(additional_cost_per_trade),
        "cost_scenario_multipliers": [0, 1, 2],
        "dataset_fingerprint": fingerprint,
    }
    config_hash = hashlib.sha256(
        json.dumps(experiment_config, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()

    return {
        "experiment_id": config_hash[:20],
        "dataset_fingerprint": fingerprint,
        "configuration": experiment_config,
        "research_context": research_context,
        "data_quality": quality,
        "recorded_costs": {
            "commission_and_swap_absolute_total": money(recorded_costs),
            "sample_size": len(valid),
            "interpretation": "Sum of absolute recorded commission and swap fields. Existing net P&L already includes recorded costs; these are not deducted again.",
        },
        "cost_sensitivity": scenarios,
        "methodology": {
            "split": "Chronological trade-sequence split by exit time; earlier observations are in-sample and later observations are out-of-sample.",
            "cost_stress": "User-specified additional account-currency cost per trade is deducted from recorded net P&L, then R is recalculated using the recorded initial risk.",
            "not_modeled": [
                "Historical bid/ask spread and executable fill reconstruction are not inferred.",
                "Slippage is not modeled unless the user-supplied extra-cost assumption is intended to approximate it.",
                "Changed entry, stop-loss, take-profit, and position-sizing rules are not replayed against candles.",
                "The split is descriptive validation, not proof of causal edge or future profitability.",
            ],
        },
        "disclaimer": "Historical cohort experiment only — not a candle-level backtest, trading signal, or automated strategy validation.",
    }
