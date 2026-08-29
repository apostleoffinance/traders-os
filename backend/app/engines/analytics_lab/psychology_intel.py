"""Psychology Intelligence — emotion performance matrix."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.confidence import confidence_payload
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, journal_rows
from app.engines.analytics_views import dump_perf_group
from app.engines.fx_math import ZERO, ratio


def _emotion_matrix(
    trades: Sequence[AnalyticsTrade],
    *,
    starting: Decimal,
    field: str,
) -> list[dict]:
    buckets: dict[str, list[AnalyticsTrade]] = defaultdict(list)
    for t in closed_trades(list(trades)):
        val = getattr(t, field, None) or "unknown"
        buckets[str(val)].append(t)
    rows = []
    for key, items in sorted(buckets.items(), key=lambda kv: -len(kv[1])):
        row = dump_perf_group(key, journal_rows(items), starting, f"Emotion {field}")
        rows.append(
            {
                "emotion": key,
                "n": row["n"],
                "win_rate": row["win_rate"],
                "average_r": row["average_r"],
                "expectancy_r": row["expectancy_r"],
                "net_pnl": row["net_pnl"],
                "evidence": row["evidence"],
                "disclaimer": "Association in your historical sample — not causation.",
            }
        )
    return rows


def _scalar_buckets(trades: Sequence[AnalyticsTrade], *, starting: Decimal, field: str, threshold: int = 5) -> list[dict]:
    high: list[AnalyticsTrade] = []
    low: list[AnalyticsTrade] = []
    for t in closed_trades(list(trades)):
        val = getattr(t, field, 0) or 0
        if val >= threshold:
            high.append(t)
        else:
            low.append(t)
    out = []
    for label, items in ((f"High {field}", high), (f"Low {field}", low)):
        row = dump_perf_group(label, journal_rows(items), starting, label)
        out.append({"bucket": label, "n": row["n"], "win_rate": row["win_rate"], "average_r": row["average_r"], "expectancy_r": row["expectancy_r"]})
    return out


def build_psychology_intelligence(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    closed = closed_trades(list(trades))
    n = len(closed)
    with_psych = [t for t in closed if t.emotion_before or t.fomo or t.fear]
    completeness = len(with_psych) / n if n else 0

    return {
        "matrix_before": _emotion_matrix(trades, starting=starting, field="emotion_before"),
        "matrix_during": _emotion_matrix(trades, starting=starting, field="emotion_during"),
        "matrix_after": _emotion_matrix(trades, starting=starting, field="emotion_after"),
        "flags": {
            "fomo": _scalar_buckets(trades, starting=starting, field="fomo"),
            "fear": _scalar_buckets(trades, starting=starting, field="fear"),
            "frustration": _scalar_buckets(trades, starting=starting, field="frustration"),
            "revenge": _scalar_buckets(trades, starting=starting, field="revenge_intensity"),
        },
        "emotional_trades": _compare_emotional(trades, starting=starting),
        "confidence": confidence_payload(n, metric="Psychology", completeness=completeness),
        "sample_size": n,
        "disclaimer": "Correlation does not equal causation. Psychology tags are self-reported associations.",
    }


def _compare_emotional(trades: Sequence[AnalyticsTrade], *, starting: Decimal) -> dict:
    emotional = [t for t in closed_trades(list(trades)) if t.emotional_trade]
    non_emotional = [t for t in closed_trades(list(trades)) if not t.emotional_trade]
    e_row = dump_perf_group("emotional", journal_rows(emotional), starting, "Emotional")
    n_row = dump_perf_group("non_emotional", journal_rows(non_emotional), starting, "Non-emotional")
    return {"emotional": e_row, "non_emotional": n_row}
