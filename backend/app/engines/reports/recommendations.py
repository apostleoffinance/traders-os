"""Deterministic KEEP / REVIEW / REDUCE recommendations — process-focused."""

from __future__ import annotations

from decimal import Decimal

from app.engines.reports.constants import MIN_SAMPLE_SIZE_RESEARCH


def build_recommendations(
    *,
    lab: dict,
    comparison: dict | None,
    n: int,
) -> dict:
    keep: list[dict] = []
    review: list[dict] = []
    reduce: list[dict] = []

    if n == 0:
        return {
            "keep": [],
            "review": [{"id": "sample", "text": "Log and close trades to generate meaningful recommendations.", "evidence": []}],
            "reduce": [],
            "disclaimer": "Recommendations focus on process, risk, and research — not trade signals.",
        }

    edge = lab.get("edge", {})
    intel = lab.get("intelligence", {})
    risk = lab.get("risk_analytics", {})
    execution = lab.get("execution", {})

    # Best session
    sessions = edge.get("sessions", [])
    if sessions:
        top = max(sessions, key=lambda s: Decimal(str(s.get("expectancy_r") or 0)) if s.get("n", 0) >= MIN_SAMPLE_SIZE_RESEARCH else Decimal("-999"))
        if top.get("n", 0) >= MIN_SAMPLE_SIZE_RESEARCH and top.get("expectancy_r"):
            keep.append({
                "id": "session_edge",
                "text": f"Maintain focus on {top.get('key', 'top')} session — highest expectancy in sample ({top.get('expectancy_r')}R, n={top.get('n')}).",
                "evidence": [{"metric": "expectancy_r", "value": top.get("expectancy_r"), "n": top.get("n")}],
            })

    # Weak session
    weak_sess = [s for s in sessions if s.get("n", 0) >= MIN_SAMPLE_SIZE_RESEARCH and s.get("expectancy_r") is not None]
    if weak_sess:
        bottom = min(weak_sess, key=lambda s: Decimal(str(s.get("expectancy_r"))))
        if Decimal(str(bottom.get("expectancy_r"))) < Decimal("0"):
            review.append({
                "id": "weak_session",
                "text": f"Review {bottom.get('key')} session trades — negative expectancy ({bottom.get('expectancy_r')}R, n={bottom.get('n')}).",
                "evidence": [{"metric": "expectancy_r", "value": bottom.get("expectancy_r"), "n": bottom.get("n")}],
            })

    # Exit efficiency
    exit_eff = execution.get("exit_efficiency", {})
    if exit_eff.get("available") and exit_eff.get("median_capture_pct"):
        med = Decimal(str(exit_eff.get("median_capture_pct")))
        if med < Decimal("50"):
            review.append({
                "id": "exit_efficiency",
                "text": f"Review exit management — median MFE capture {med}% suggests favorable movement not fully realized.",
                "evidence": [{"metric": "median_capture_pct", "value": str(med)}],
            })

    # Risk escalation after losses
    beh = intel.get("behaviour", {}) if intel else {}
    revenge = beh.get("revenge_trading", {}) if beh else {}
    if revenge.get("risk_multiplier_after_loss_pct"):
        pct = Decimal(str(revenge["risk_multiplier_after_loss_pct"]))
        if pct > Decimal("15") and revenge.get("post_loss_trade_count", 0) >= MIN_SAMPLE_SIZE_RESEARCH:
            reduce.append({
                "id": "risk_escalation",
                "text": f"Average risk increased {pct}% after losses — investigate sizing discipline.",
                "evidence": [{"metric": "risk_multiplier_after_loss_pct", "value": str(pct), "n": revenge.get("post_loss_trade_count")}],
            })

    # Outside preferred session
    segments = intel.get("segments", {}) if intel else {}
    outside_n = segments.get("outside_session", 0)
    if isinstance(outside_n, int) and outside_n >= MIN_SAMPLE_SIZE_RESEARCH:
        review.append({
            "id": "outside_session",
            "text": f"{outside_n} trades occurred outside preferred session windows — review timing discipline.",
            "evidence": [{"n": outside_n}],
        })

    # Comparison deterioration
    if comparison and comparison.get("available"):
        for row in comparison.get("rows", []):
            if row.get("metric") == "Expectancy R" and row.get("benefit") == "negative":
                review.append({
                    "id": "expectancy_trend",
                    "text": f"Expectancy declined vs previous period ({row.get('previous')}R → {row.get('current')}R).",
                    "evidence": [row],
                })
                break

    if not keep and n >= MIN_SAMPLE_SIZE_RESEARCH:
        keep.append({
            "id": "journal_consistency",
            "text": "Continue journaling with discipline scores and setup labels to strengthen future reports.",
            "evidence": [{"n": n}],
        })

    return {
        "keep": keep,
        "review": review,
        "reduce": reduce,
        "disclaimer": "Recommendations focus on process, risk, and research — not trade signals or buy/sell advice.",
    }
