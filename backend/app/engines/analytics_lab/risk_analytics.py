"""Advanced risk analytics — distribution, consistency, escalation."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from statistics import median
from typing import Sequence

from app.core.enums import TradeStatus
from app.engines.analytics_lab.sample_rules import sample_note, with_evidence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows, ordered_closed, to_journal_trade
from app.engines.analytics_views import dump_perf_group, streak_histogram
from app.engines.fx_math import ZERO, money, ratio
from app.engines.performance_engine import _stdev_sample, compute_performance
from app.engines.risk_engine import ClosedTrade, build_equity_curve

DEFAULT_RISK_PERCENT_BUCKETS = [
    ("< 0.5%", None, Decimal("0.5")),
    ("0.5% – 1%", Decimal("0.5"), Decimal("1")),
    ("1% – 2%", Decimal("1"), Decimal("2")),
    ("2% – 3%", Decimal("2"), Decimal("3")),
    ("> 3%", Decimal("3"), None),
]


def _risk_bucket(pct: Decimal, buckets=DEFAULT_RISK_PERCENT_BUCKETS) -> str:
    for label, lo, hi in buckets:
        if lo is not None and pct < lo:
            continue
        if hi is not None and pct >= hi:
            continue
        return label
    return buckets[-1][0]


def _risk_stats(values: list[Decimal]) -> dict:
    if not values:
        return {"n": 0, "mean": None, "median": None, "min": None, "max": None, "stdev": None}
    return {
        "n": len(values),
        "mean": money(sum(values, ZERO) / Decimal(len(values))),
        "median": money(Decimal(str(median([float(v) for v in values])))),
        "min": money(min(values)),
        "max": money(max(values)),
        "stdev": ratio(_stdev_sample(values)) if len(values) >= 2 else None,
    }


def _in_drawdown_at(curve, exit_at) -> bool:
    from app.core.time import as_utc as au

    ts = au(exit_at)
    point = None
    for p in curve:
        if p.at <= ts:
            point = p
        else:
            break
    return point is not None and point.drawdown > ZERO


def build_risk_analytics(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    configured_risk: Decimal | None,
    risk_tolerance_pct: Decimal = Decimal("10"),
) -> dict:
    closed = closed_trades(list(trades))
    with_risk = [t for t in closed if t.risk_amount > ZERO]
    with_risk_pct = [t for t in closed if t.risk_percent > ZERO]

    risk_amounts = [t.risk_amount for t in with_risk]
    risk_pcts = [t.risk_percent for t in with_risk_pct]

    bucket_groups: dict[str, list[AnalyticsTrade]] = defaultdict(list)
    for t in with_risk_pct:
        bucket_groups[_risk_bucket(t.risk_percent)].append(t)

    risk_vs_outcome = []
    for label, _lo, _hi in DEFAULT_RISK_PERCENT_BUCKETS:
        items = bucket_groups.get(label, [])
        if not items:
            risk_vs_outcome.append(
                {
                    "bucket": label,
                    "n": 0,
                    "win_rate": None,
                    "average_r": None,
                    "net_pnl": None,
                    "profit_factor": None,
                }
            )
            continue
        journals = [to_journal_trade(t) for t in items]
        row = dump_perf_group(label, journals, starting, "Risk bucket")
        risk_vs_outcome.append(
            {
                "bucket": label,
                "n": row["n"],
                "win_rate": row["win_rate"],
                "average_r": row["average_r"],
                "net_pnl": row["net_pnl"],
                "profit_factor": row["profit_factor"],
            }
        )

    configured = configured_risk
    avg_actual = sum(risk_amounts, ZERO) / Decimal(len(risk_amounts)) if risk_amounts else None
    deviation_pct = None
    within_tolerance = None
    if configured and configured > ZERO and avg_actual is not None:
        deviation_pct = ratio((avg_actual - configured) / configured * Decimal("100"))
        tol = configured * (Decimal("1") + risk_tolerance_pct / Decimal("100"))
        within = sum(1 for r in risk_amounts if r <= tol)
        within_tolerance = ratio(Decimal(within) / Decimal(len(risk_amounts)) * Decimal("100"))

    ordered = ordered_closed(trades)
    after_win_risks: list[Decimal] = []
    after_loss_risks: list[Decimal] = []
    for i in range(1, len(ordered)):
        prev = ordered[i - 1]
        cur = ordered[i]
        if cur.risk_amount <= ZERO:
            continue
        outcome = prev.classify_outcome()
        if outcome == "win":
            after_win_risks.append(cur.risk_amount)
        elif outcome == "loss":
            after_loss_risks.append(cur.risk_amount)

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
        for t in ordered
    ]
    curve = build_equity_curve(starting, closed_views)
    in_dd_risks: list[Decimal] = []
    out_dd_risks: list[Decimal] = []
    for t in ordered:
        if t.risk_amount <= ZERO or t.exit_at is None:
            continue
        if _in_drawdown_at(curve, t.exit_at):
            in_dd_risks.append(t.risk_amount)
        else:
            out_dd_risks.append(t.risk_amount)

    def _escalation(after: list[Decimal], baseline: list[Decimal], context: str) -> dict | None:
        if not after or not baseline:
            return None
        avg_after = sum(after, ZERO) / Decimal(len(after))
        avg_base = sum(baseline, ZERO) / Decimal(len(baseline))
        if avg_base <= ZERO:
            return None
        pct = ratio((avg_after - avg_base) / avg_base * Decimal("100"))
        return {
            "context": context,
            "average_risk": money(avg_after),
            "baseline_average_risk": money(avg_base),
            "pct_difference": pct,
            "n_after": len(after),
            "n_baseline": len(baseline),
            "wording": (
                f"Average risk was {pct}% {'higher' if Decimal(str(pct)) > 0 else 'lower'} "
                f"{context}. Descriptive only."
            ),
        }

    all_risks = [t.risk_amount for t in ordered if t.risk_amount > ZERO]
    escalation = [
        e
        for e in [
            _escalation(after_loss_risks, after_win_risks or all_risks, "following losses"),
            _escalation(after_win_risks, after_loss_risks or all_risks, "following wins"),
            _escalation(in_dd_risks, out_dd_risks, "during drawdowns"),
            _escalation(out_dd_risks, in_dd_risks, "outside drawdowns"),
        ]
        if e
    ]

    pct_dist: dict[str, int] = defaultdict(int)
    for pct in risk_pcts:
        pct_dist[_risk_bucket(pct)] += 1

    return {
        "distribution": {
            "risk_amount": {**_risk_stats(risk_amounts), "evidence": with_evidence(len(risk_amounts))},
            "risk_percent": {
                **_risk_stats(risk_pcts),
                "buckets": [
                    {"label": label, "n": pct_dist.get(label, 0)}
                    for label, _lo, _hi in DEFAULT_RISK_PERCENT_BUCKETS
                ],
                "evidence": with_evidence(len(risk_pcts)),
            },
            "missing_risk": len(closed) - len(with_risk),
            "sample_note": sample_note(len(with_risk)),
        },
        "consistency": {
            "configured_risk": money(configured) if configured else None,
            "average_actual_risk": money(avg_actual) if avg_actual is not None else None,
            "median_actual_risk": money(Decimal(str(median([float(r) for r in risk_amounts])))) if risk_amounts else None,
            "deviation_pct": deviation_pct,
            "within_tolerance_pct": within_tolerance,
            "tolerance_pct": ratio(risk_tolerance_pct),
            "valid_observations": len(with_risk),
            "missing_data": len(closed) - len(with_risk),
            "evidence": with_evidence(len(with_risk)),
            "sample_note": sample_note(len(with_risk)),
        },
        "risk_vs_outcome": risk_vs_outcome,
        "escalation": escalation,
        "consecutive_losses": {
            "maximum": compute_performance(
                [
                    ClosedTrade(
                        id=t.id,
                        entry_at=t.entry_at,
                        exit_at=t.exit_at,
                        risk_amount=t.risk_amount,
                        realized_pnl=t.net_pnl,
                        result=t.result,
                        status=TradeStatus.CLOSED,
                    )
                    for t in ordered
                ],
                starting,
            ).max_consecutive_losses
            if ordered
            else 0,
            "distribution": streak_histogram(journal_rows(trades))["loss_distribution"] if ordered else [],
        },
        "evidence": with_evidence(len(closed)),
    }
