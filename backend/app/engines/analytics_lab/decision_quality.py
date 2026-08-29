"""Decision Quality vs Outcome matrix."""

from __future__ import annotations

from typing import Sequence

from app.engines.analytics_lab.confidence import confidence_payload
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades


def _process_quality(t: AnalyticsTrade) -> str:
    """GOOD_PROCESS or POOR_PROCESS — independent of P/L."""
    score = 0
    if t.discipline_score is not None:
        if t.discipline_score >= 70:
            score += 2
        elif t.discipline_score < 50:
            score -= 2
    if t.rules_followed:
        score += 1
    else:
        score -= 1
    if t.setup_valid:
        score += 1
    else:
        score -= 2
    if t.checklist_total > 0 and t.checklist_checked >= t.checklist_total:
        score += 1
    elif t.checklist_total > 0:
        score -= 1
    if t.emotional_trade or t.revenge_intensity >= 5:
        score -= 2
    if t.mistake:
        score -= 2
    return "GOOD_PROCESS" if score >= 2 else "POOR_PROCESS"


def _outcome_bucket(t: AnalyticsTrade) -> str:
    o = t.classify_outcome()
    return "WIN" if o == "win" else "LOSS" if o == "loss" else "BREAKEVEN"


def build_decision_quality(trades: Sequence[AnalyticsTrade]) -> dict:
    closed = closed_trades(list(trades))
    matrix = {
        "GOOD_PROCESS": {"WIN": 0, "LOSS": 0, "BREAKEVEN": 0},
        "POOR_PROCESS": {"WIN": 0, "LOSS": 0, "BREAKEVEN": 0},
    }
    cells = {
        "good_win": [],
        "good_loss": [],
        "lucky_win": [],
        "bad_loss": [],
    }
    for t in closed:
        proc = _process_quality(t)
        out = _outcome_bucket(t)
        matrix[proc][out] += 1
        if proc == "GOOD_PROCESS" and out == "WIN":
            cells["good_win"].append(t.id)
        elif proc == "GOOD_PROCESS" and out == "LOSS":
            cells["good_loss"].append(t.id)
        elif proc == "POOR_PROCESS" and out == "WIN":
            cells["lucky_win"].append(t.id)
        elif proc == "POOR_PROCESS" and out == "LOSS":
            cells["bad_loss"].append(t.id)

    n = len(closed)
    return {
        "matrix": matrix,
        "labels": {
            "good_win": "Good Process / Win",
            "good_loss": "Good Process / Loss",
            "lucky_win": "Poor Process / Win (Lucky Win)",
            "bad_loss": "Poor Process / Loss (Bad Loss)",
        },
        "counts": {k: len(v) for k, v in cells.items()},
        "trade_ids": {k: v[:20] for k, v in cells.items()},
        "methodology": "Process quality uses discipline, checklist, setup validity, rules, and emotional flags — not P/L.",
        "confidence": confidence_payload(n, metric="Decision quality"),
        "sample_size": n,
    }
