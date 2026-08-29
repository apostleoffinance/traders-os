"""Deterministic executive summary metrics — no LLM."""

from __future__ import annotations

from decimal import Decimal

from app.engines.fx_math import ZERO, money, ratio


def build_executive_summary(
    *,
    performance: dict,
    discipline_score: int | None,
    starting_balance: Decimal,
    currency: str,
    status: dict,
) -> dict:
    kpis = performance.get("kpis", {})
    wl = performance.get("win_loss", {})

    net = kpis.get("net_pnl", {}).get("value")
    net_dec = Decimal(str(net)) if net is not None else ZERO
    ret_pct = None
    if starting_balance > ZERO and net is not None:
        ret_pct = ratio(net_dec / starting_balance * 100)

    return {
        "scorecard": {
            "net_performance": {
                "value": str(money(net_dec)) if net is not None else "—",
                "return_pct": f"{ret_pct}%" if ret_pct is not None else None,
            },
            "profit_factor": kpis.get("profit_factor", {}).get("value"),
            "expectancy_r": kpis.get("expectancy_r", {}).get("value"),
            "discipline": discipline_score,
            "trades": wl.get("n", 0),
        },
        "status": status,
        "narrative_seed": _narrative_seed(performance, discipline_score, status),
    }


def _narrative_seed(performance: dict, discipline_score: int | None, status: dict) -> list[str]:
    """Deterministic bullet points for AI or display — evidence-backed."""
    bullets: list[str] = []
    wl = performance.get("win_loss", {})
    n = wl.get("n", 0)
    if n == 0:
        return ["No closed trades in this period."]

    bullets.append(f"{n} closed trades in period.")
    wr = wl.get("win_rate")
    if wr:
        bullets.append(f"Win rate {wr}%.")
    exp = performance.get("kpis", {}).get("expectancy_r", {}).get("value")
    if exp:
        bullets.append(f"Expectancy {exp}R per trade.")
    if discipline_score is not None:
        bullets.append(f"Average discipline score {discipline_score}/100.")
    bullets.append(f"Performance status: {status.get('headline', status.get('status'))}.")
    return bullets
