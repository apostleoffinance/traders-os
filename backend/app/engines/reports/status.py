"""Deterministic performance status — multi-dimensional, explainable."""

from __future__ import annotations

from decimal import Decimal

from app.engines.fx_math import ZERO


def classify_performance_status(
    *,
    n: int,
    net_pnl: Decimal | None,
    expectancy_r: Decimal | None,
    profit_factor: Decimal | None,
    max_drawdown_pct: Decimal | None,
    discipline_score: int | None,
    risk_violations: int,
    emotional_trades: int,
) -> dict:
    """Return status label, score 0–100, and contributing factors."""
    if n == 0:
        return {
            "status": "NEEDS_ATTENTION",
            "headline": "NO ACTIVITY",
            "score": None,
            "factors": ["No closed trades in this period."],
        }

    factors: list[str] = []
    score = Decimal("50")

    # Profitability & edge
    if net_pnl is not None:
        if net_pnl > ZERO:
            score += Decimal("12")
            factors.append("Net P/L positive for the period.")
        elif net_pnl < ZERO:
            score -= Decimal("12")
            factors.append("Net P/L negative for the period.")

    if expectancy_r is not None:
        if expectancy_r > Decimal("0.15"):
            score += Decimal("10")
            factors.append(f"Expectancy {expectancy_r}R suggests positive edge in sample.")
        elif expectancy_r < Decimal("-0.15"):
            score -= Decimal("10")
            factors.append(f"Expectancy {expectancy_r}R is negative in sample.")

    if profit_factor is not None:
        pf = Decimal(str(profit_factor))
        if pf >= Decimal("1.5"):
            score += Decimal("6")
        elif pf < Decimal("1"):
            score -= Decimal("6")
            factors.append(f"Profit factor {pf} below 1.0.")

    # Risk
    if max_drawdown_pct is not None:
        dd = Decimal(str(max_drawdown_pct))
        if dd > Decimal("15"):
            score -= Decimal("15")
            factors.append(f"Maximum drawdown {dd}% elevated.")
        elif dd < Decimal("5"):
            score += Decimal("5")

    if risk_violations > 0:
        score -= Decimal(min(20, risk_violations * 5))
        factors.append(f"{risk_violations} risk policy violation(s) detected.")

    # Discipline
    if discipline_score is not None:
        if discipline_score >= 85:
            score += Decimal("10")
            factors.append(f"Discipline score {discipline_score}/100 — strong process.")
        elif discipline_score < 60:
            score -= Decimal("10")
            factors.append(f"Discipline score {discipline_score}/100 — process gaps.")

    if emotional_trades > 0 and n > 0:
        pct = emotional_trades / n * 100
        if pct >= 25:
            score -= Decimal("8")
            factors.append(f"{pct:.0f}% of trades flagged emotional.")

    score = max(ZERO, min(Decimal("100"), score))
    s = int(score)

    if risk_violations >= 3 or (max_drawdown_pct and Decimal(str(max_drawdown_pct)) > Decimal("20")):
        status, headline = "HIGH_RISK", "HIGH RISK"
    elif s >= 75:
        status, headline = "STRONG", "STRONG PERIOD"
    elif s >= 60:
        status, headline = "STABLE", "STABLE"
    elif s >= 45:
        status, headline = "MIXED", "MIXED"
    else:
        status, headline = "NEEDS_ATTENTION", "NEEDS ATTENTION"

    # Profitable but risky → MIXED not STRONG
    if status == "STRONG" and (risk_violations > 0 or (discipline_score is not None and discipline_score < 70)):
        status, headline = "MIXED", "MIXED"

    return {
        "status": status,
        "headline": headline,
        "score": s,
        "factors": factors or ["Insufficient signals for detailed classification."],
    }
