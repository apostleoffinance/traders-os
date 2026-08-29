"""Walk-forward / historical period comparison."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Sequence

from app.core.time import as_utc
from app.engines.analytics_lab.trade_row import AnalyticsTrade, ordered_closed
from app.engines.fx_math import ZERO, money, ratio
from app.engines.quant_lab.drawdown import build_drawdown
from app.engines.quant_lab.expectancy import build_expectancy
from app.engines.quant_lab.sample_policy import sample_payload


def _profit_factor(trades: Sequence[AnalyticsTrade]) -> Decimal | None:
    wins = sum((t.net_pnl for t in trades if t.net_pnl > ZERO), ZERO)
    losses = abs(sum((t.net_pnl for t in trades if t.net_pnl < ZERO), ZERO))
    if losses == ZERO:
        return None
    return ratio(wins / losses)


def _metrics(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    exp = build_expectancy(trades)
    rs = [t.r_multiple for t in trades if t.r_multiple is not None]
    dd = build_drawdown(trades, starting=starting)
    return {
        "n": len(trades),
        "expectancy_r": exp["expectancy_r"],
        "win_rate": exp["win_rate"],
        "profit_factor": _profit_factor(trades),
        "average_r": ratio(sum(rs, ZERO) / Decimal(len(rs))) if rs else None,
        "max_drawdown_r": dd["r_multiple"]["max_drawdown_r"],
        "net_pnl": money(sum((t.net_pnl for t in trades), ZERO)),
    }


def _diff(a: dict, b: dict) -> dict:
    out = {}
    for key in ("expectancy_r", "win_rate", "profit_factor", "average_r", "max_drawdown_r"):
        av, bv = a.get(key), b.get(key)
        if av is None or bv is None:
            out[key] = {"absolute": None, "percentage": None}
            continue
        a_d, b_d = Decimal(str(av)), Decimal(str(bv))
        abs_diff = b_d - a_d
        pct = ratio(abs_diff / abs(a_d) * Decimal("100")) if a_d != ZERO else None
        out[key] = {"absolute": ratio(abs_diff), "percentage": pct}
    return out


def _split_by_ratio(trades: Sequence[AnalyticsTrade], ratio_split: float) -> tuple[list[AnalyticsTrade], list[AnalyticsTrade]]:
    ordered = ordered_closed(trades)
    if not ordered:
        return [], []
    cut = max(1, min(len(ordered) - 1, int(len(ordered) * ratio_split)))
    return ordered[:cut], ordered[cut:]


def _filter_by_dates(
    trades: Sequence[AnalyticsTrade],
    *,
    start: datetime | None,
    end: datetime | None,
) -> list[AnalyticsTrade]:
    out = []
    for t in ordered_closed(trades):
        if t.exit_at is None:
            continue
        ts = as_utc(t.exit_at)
        if start and ts < start:
            continue
        if end and ts > end:
            continue
        out.append(t)
    return out


def build_walk_forward(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    training_from: datetime | None = None,
    training_to: datetime | None = None,
    validation_from: datetime | None = None,
    validation_to: datetime | None = None,
    split_ratio: float = 0.7,
) -> dict:
    if training_from or training_to or validation_from or validation_to:
        train = _filter_by_dates(trades, start=training_from, end=training_to)
        valid = _filter_by_dates(trades, start=validation_from, end=validation_to)
        method = "date_ranges"
    else:
        train, valid = _split_by_ratio(trades, split_ratio)
        method = "trade_sequence_split"

    in_sample = _metrics(train, starting=starting)
    out_sample = _metrics(valid, starting=starting)

    return {
        "label": "HISTORICAL PERIOD COMPARISON",
        "method": method,
        "split_ratio": split_ratio if method == "trade_sequence_split" else None,
        "training_period": {
            "from": training_from.isoformat() if training_from else None,
            "to": training_to.isoformat() if training_to else None,
        },
        "validation_period": {
            "from": validation_from.isoformat() if validation_from else None,
            "to": validation_to.isoformat() if validation_to else None,
        },
        "in_sample": in_sample,
        "out_of_sample": out_sample,
        "differences": _diff(in_sample, out_sample),
        "disclaimer": (
            "In-sample vs out-of-sample comparison is descriptive. "
            "It is not automatic strategy validation."
        ),
        "category": "OBSERVED_PERFORMANCE",
        "sample": sample_payload(len(train) + len(valid)),
    }
