"""Comparable-trade evidence. Timestamps are respected to avoid look-ahead."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Sequence

from app.ai.guardrails.confidence import classify_confidence, confidence_reason
from app.ai.schemas import EvidenceConfidence
from app.core.time import as_utc
from app.engines.fx_math import ZERO
from app.engines.performance_engine import compute_performance, rr_bucket
from app.models.trade import Trade


@dataclass
class ComparableReport:
    n: int
    expectancy_r: Decimal | None
    win_rate: Decimal | None
    profit_factor: Decimal | None
    average_r: Decimal | None
    confidence: EvidenceConfidence
    reason: str
    by_session: dict[str, dict]
    by_setup: dict[str, dict]
    by_psychology: dict[str, dict]


def _as_of(trade: Trade) -> datetime:
    ts = trade.exit_timestamp or trade.trade_timestamp
    return as_utc(ts)


def prior_trades(all_trades: Sequence[Trade], as_of: datetime) -> list[Trade]:
    cutoff = as_utc(as_of)
    out: list[Trade] = []
    for t in all_trades:
        ts = t.exit_timestamp or t.trade_timestamp
        if as_utc(ts) < cutoff:
            out.append(t)
    return out


def similarity_score(current: Trade, other: Trade) -> float:
    score = 0.0
    if current.symbol == other.symbol:
        score += 1.0
    if current.session == other.session:
        score += 1.0
    if current.setup_id and current.setup_id == other.setup_id:
        score += 1.0
    if current.direction == other.direction:
        score += 1.0
    if current.timeframe == other.timeframe:
        score += 1.0
    if rr_bucket(current.planned_rr) == rr_bucket(other.planned_rr):
        score += 0.5
    if current.trade_timestamp.strftime("%A") == other.trade_timestamp.strftime("%A"):
        score += 0.5
    cur_e = current.psychology.emotion_before if current.psychology else None
    oth_e = other.psychology.emotion_before if other.psychology else None
    if cur_e and oth_e and cur_e == oth_e:
        score += 0.5
    return score


def comparable_trades(current: Trade, universe: Sequence[Trade], *, min_score: float = 2.0) -> list[Trade]:
    prior = prior_trades(universe, _as_of(current))
    scored = [(similarity_score(current, t), t) for t in prior if t.id != current.id]
    return [t for s, t in scored if s >= min_score]


def _metric_dict(trades: Sequence[Trade], starting: Decimal) -> dict:
    from app.services.mapping import trade_to_closed

    closed = [trade_to_closed(t) for t in trades]
    m = compute_performance(closed, starting)
    return {
        "n": m.n_trades,
        "expectancy_r": m.expectancy_r,
        "win_rate": m.win_rate,
        "profit_factor": m.profit_factor,
        "average_r": m.average_r,
    }


def build_comparable_report(
    current: Trade,
    universe: Sequence[Trade],
    starting_balance: Decimal,
) -> ComparableReport:
    comps = comparable_trades(current, universe)
    metrics = _metric_dict(comps, starting_balance)
    n = int(metrics["n"])
    # crude variance flag: mixed signs in expectancy buckets
    r_vals = []
    from app.services.mapping import trade_to_closed

    for t in comps:
        ct = trade_to_closed(t)
        if ct.risk_amount > ZERO:
            r_vals.append(ct.realized_pnl / ct.risk_amount)
    high_var = False
    if len(r_vals) >= 5:
        pos = sum(1 for r in r_vals if r > 0)
        high_var = 0.3 <= pos / len(r_vals) <= 0.7 and n < 80
    level = classify_confidence(n, high_variance=high_var)
    by_session: dict[str, dict] = {}
    by_setup: dict[str, dict] = {}
    by_psy: dict[str, dict] = {}
    for t in comps:
        by_session.setdefault(t.session, []).append(t)
        key = t.setup.name if t.setup else "unclassified"
        by_setup.setdefault(key, []).append(t)
        emo = t.psychology.emotion_before if t.psychology else "unknown"
        by_psy.setdefault(emo, []).append(t)
    return ComparableReport(
        n=n,
        expectancy_r=metrics["expectancy_r"],
        win_rate=metrics["win_rate"],
        profit_factor=metrics["profit_factor"],
        average_r=metrics["average_r"],
        confidence=level,
        reason=confidence_reason(n, level),
        by_session={k: _metric_dict(v, starting_balance) for k, v in by_session.items()},
        by_setup={k: _metric_dict(v, starting_balance) for k, v in by_setup.items()},
        by_psychology={k: _metric_dict(v, starting_balance) for k, v in by_psy.items()},
    )


def candidate_patterns(trades: Sequence[Trade], starting: Decimal) -> list[dict]:
    """Deterministic pattern candidates. Gemini only interprets these."""
    buckets: dict[str, list[Trade]] = {}
    for t in trades:
        setup = t.setup.name if t.setup else "unclassified"
        buckets.setdefault(f"session:{t.session}", []).append(t)
        buckets.setdefault(f"setup:{setup}", []).append(t)
        buckets.setdefault(f"{t.session} + {setup}", []).append(t)
        emo = t.psychology.emotion_before if t.psychology else None
        if emo:
            buckets.setdefault(f"psychology:{emo}", []).append(t)
            buckets.setdefault(f"{emo} + {setup}", []).append(t)
    out: list[dict] = []
    for title, items in buckets.items():
        m = _metric_dict(items, starting)
        n = int(m["n"])
        if n < 3:
            continue
        level = classify_confidence(n)
        out.append(
            {
                "title": title,
                "sample_size": n,
                "expectancy_r": m["expectancy_r"],
                "win_rate": m["win_rate"],
                "profit_factor": m["profit_factor"],
                "confidence": level.value,
                "confidence_reason": confidence_reason(n, level),
            }
        )
    out.sort(key=lambda x: (-x["sample_size"], str(x["expectancy_r"])))
    return out[:12]
