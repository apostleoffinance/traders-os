"""Execution analytics — position size, duration buckets, MFE/MAE, exit efficiency."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from statistics import median
from typing import Sequence

from app.engines.analytics_lab.edge import _bucket_metrics
from app.engines.analytics_lab.sample_rules import sample_note, with_evidence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades
from app.engines.fx_math import ZERO, ratio
from app.engines.mfe_mae import exit_capture_ratio

# Centralized duration bucket boundaries (seconds)
DURATION_BUCKETS: list[tuple[str, int, int | None]] = [
    ("Under 5m", 0, 300),
    ("5–15m", 300, 900),
    ("15–30m", 900, 1800),
    ("30–60m", 1800, 3600),
    ("1–4h", 3600, 14400),
    ("4h+", 14400, None),
]

# Risk % buckets
RISK_PERCENT_BUCKETS: list[tuple[str, Decimal, Decimal | None]] = [
    ("0–0.25%", Decimal("0"), Decimal("0.25")),
    ("0.25–0.5%", Decimal("0.25"), Decimal("0.5")),
    ("0.5–1%", Decimal("0.5"), Decimal("1")),
    ("1%+", Decimal("1"), None),
]


def _duration_label(seconds: int | None) -> str:
    if seconds is None:
        return "unknown"
    for label, lo, hi in DURATION_BUCKETS:
        if hi is None and seconds >= lo:
            return label
        if hi is not None and lo <= seconds < hi:
            return label
    return "unknown"


def _risk_bucket(risk_percent: Decimal) -> str:
    for label, lo, hi in RISK_PERCENT_BUCKETS:
        if hi is None and risk_percent >= lo:
            return label
        if hi is not None and lo <= risk_percent < hi:
            return label
    return "unknown"


def _median_ratio(values: list[Decimal]) -> str | None:
    if not values:
        return None
    return ratio(Decimal(str(median([float(v) for v in values]))))


def _build_mfe_mae(closed: list[AnalyticsTrade], n: int) -> dict:
    with_data = [t for t in closed if t.mfe_r is not None and t.mae_r is not None]
    mfe_n = len(with_data)
    if mfe_n == 0:
        mt5_count = sum(1 for t in closed if t.mfe_mae_source)
        reason = (
            "MFE/MAE requires intratrade market data. "
            "Update TraderOSSync EA to the latest version and close new trades from MT5, "
            "or ensure M1 history is available in your terminal."
        )
        if n > 0 and mt5_count == 0:
            reason = (
                "No trades in this sample have MFE/MAE data. "
                "MT5-synced trades closed after updating TraderOSSync will include M1-based excursions."
            )
        return {
            "available": False,
            "reason": reason,
            "coverage_n": 0,
            "coverage_pct": None,
            "evidence": with_evidence(n),
        }

    mfe_rs = [t.mfe_r for t in with_data if t.mfe_r is not None]
    mae_rs = [t.mae_r for t in with_data if t.mae_r is not None]
    coverage_pct = ratio(Decimal(mfe_n) / Decimal(n) * 100) if n else None

    return {
        "available": True,
        "coverage_n": mfe_n,
        "coverage_pct": coverage_pct,
        "precision": "bar_ohlc",
        "source": "mt5_m1",
        "disclaimer": "Derived from M1 OHLC bars — intra-bar extremes may be understated.",
        "average_mfe_r": ratio(sum(mfe_rs, ZERO) / Decimal(len(mfe_rs))) if mfe_rs else None,
        "average_mae_r": ratio(sum(mae_rs, ZERO) / Decimal(len(mae_rs))) if mae_rs else None,
        "median_mfe_r": _median_ratio(mfe_rs),
        "median_mae_r": _median_ratio(mae_rs),
        "scatter": [
            {
                "trade_id": t.id,
                "symbol": t.symbol,
                "mfe_r": ratio(t.mfe_r) if t.mfe_r is not None else None,
                "mae_r": ratio(t.mae_r) if t.mae_r is not None else None,
                "realized_r": ratio(t.r_multiple) if t.r_multiple is not None else None,
                "result": t.classify_outcome(),
            }
            for t in with_data
        ],
        "sample_note": sample_note(mfe_n),
        "evidence": with_evidence(mfe_n),
    }


def _build_exit_efficiency(closed: list[AnalyticsTrade], n: int) -> dict:
    with_mfe = [t for t in closed if t.mfe_r is not None and t.mfe_r > ZERO and t.r_multiple is not None]
    winners = [t for t in with_mfe if t.classify_outcome() == "win"]
    if not winners:
        return {
            "available": False,
            "reason": "Exit efficiency requires winning trades with MFE data.",
            "coverage_n": 0,
            "evidence": with_evidence(n),
        }

    captures: list[Decimal] = []
    givebacks: list[Decimal] = []
    scatter = []
    for t in winners:
        cap = exit_capture_ratio(t.r_multiple, t.mfe_r)
        if cap is None:
            continue
        captures.append(cap)
        if t.mfe_r is not None and t.r_multiple is not None:
            givebacks.append(t.mfe_r - t.r_multiple)
        scatter.append(
            {
                "trade_id": t.id,
                "symbol": t.symbol,
                "mfe_r": ratio(t.mfe_r),
                "realized_r": ratio(t.r_multiple),
                "capture_ratio": ratio(cap),
            }
        )

    win_n = len(captures)
    if win_n == 0:
        return {
            "available": False,
            "reason": "No valid exit capture ratios (MFE must be positive on winners).",
            "coverage_n": 0,
            "evidence": with_evidence(n),
        }

    med_cap = _median_ratio(captures)
    med_pct = ratio(Decimal(str(med_cap)) * 100) if med_cap else None

    return {
        "available": True,
        "coverage_n": win_n,
        "average_capture": ratio(sum(captures, ZERO) / Decimal(win_n)),
        "median_capture": med_cap,
        "median_capture_pct": med_pct,
        "average_giveback_r": ratio(sum(givebacks, ZERO) / Decimal(len(givebacks))) if givebacks else None,
        "insight": (
            f"Winning trades captured a median {med_pct}% of their maximum favorable excursion (n={win_n}). "
            "Historical descriptive only — not an optimization target."
            if med_pct
            else None
        ),
        "scatter": scatter,
        "disclaimer": "Lower capture may be intentional depending on strategy design.",
        "sample_note": sample_note(win_n),
        "evidence": with_evidence(win_n),
    }


def build_execution(trades: Sequence[AnalyticsTrade]) -> dict:
    closed = closed_trades(list(trades))
    n = len(closed)

    size_buckets: dict[str, list[AnalyticsTrade]] = defaultdict(list)
    duration_buckets: dict[str, list[AnalyticsTrade]] = defaultdict(list)
    for t in closed:
        size_buckets[_risk_bucket(t.risk_percent)].append(t)
        duration_buckets[_duration_label(t.holding_time_seconds)].append(t)

    position_size = [
        {"bucket": k, **_bucket_metrics(v)}
        for k, v in sorted(size_buckets.items(), key=lambda x: x[0])
    ]
    duration = []
    for label, _, _ in DURATION_BUCKETS:
        items = duration_buckets.get(label, [])
        duration.append({"bucket": label, **_bucket_metrics(items)})

    mfe_mae = _build_mfe_mae(closed, n)
    exit_efficiency = _build_exit_efficiency(closed, n)

    return {
        "position_size": {
            "buckets": position_size,
            "method": "risk_percent",
            "disclaimer": "Historical association only — not a causal claim about position sizing.",
            "sample_note": sample_note(n),
        },
        "duration": {
            "buckets": duration,
            "sample_note": sample_note(n),
        },
        "mfe_mae": mfe_mae,
        "exit_efficiency": exit_efficiency,
        "sample_note": sample_note(n),
        "evidence": with_evidence(n),
    }
