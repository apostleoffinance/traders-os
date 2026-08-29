"""Deterministic Insight Engine — structured findings from analytics."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.confidence import ConfidenceLevel, classify_confidence


def _insight(
    *,
    id: str,
    category: str,
    severity: str,
    confidence: str,
    title: str,
    finding: str,
    evidence: dict,
    sample_size: int,
    priority: int = 50,
) -> dict:
    return {
        "id": id,
        "category": category,
        "severity": severity,
        "confidence": confidence,
        "title": title,
        "finding": finding,
        "evidence": evidence,
        "sample_size": sample_size,
        "priority": priority,
    }


def generate_insights(
  *,
    behaviour: dict,
    psychology: dict,
    discipline: dict,
    playbooks: dict,
    edge_maps: dict,
    decision_quality: dict,
    improvement: dict,
) -> list[dict]:
    insights: list[dict] = []

    revenge = behaviour.get("revenge_trading", {})
    pct = revenge.get("risk_multiplier_after_loss_pct")
    n_after = revenge.get("post_loss_trade_count", 0)
    if pct and n_after >= 5 and Decimal(str(pct)) > 15:
        conf = classify_confidence(n_after).value
        insights.append(
            _insight(
                id="risk_after_loss_increase",
                category="behaviour",
                severity="warning",
                confidence=conf.lower(),
                title="Risk increases after losses",
                finding=f"Historically, your average risk was {pct}% higher following losing trades (n={n_after}). Descriptive only.",
                evidence={"difference_pct": pct, "post_loss_n": n_after, "baseline_risk": revenge.get("baseline_risk")},
                sample_size=n_after,
                priority=80,
            )
        )

    high_low = discipline.get("discipline_vs_performance", {}).get("high_vs_low", {})
    hi = high_low.get("high_discipline", {})
    lo = high_low.get("low_discipline", {})
    if hi.get("n", 0) >= 5 and lo.get("n", 0) >= 5:
        hi_exp = hi.get("expectancy_r")
        lo_exp = lo.get("expectancy_r")
        if hi_exp and lo_exp and Decimal(str(hi_exp)) > Decimal(str(lo_exp)):
            insights.append(
                _insight(
                    id="discipline_expectancy_association",
                    category="discipline",
                    severity="observation",
                    confidence=classify_confidence(min(hi["n"], lo["n"])).value.lower(),
                    title="High-discipline trades show stronger historical expectancy",
                    finding="In your sample, trades with discipline ≥85 had higher expectancy than trades below 70. Association only.",
                    evidence={"high_expectancy_r": hi_exp, "low_expectancy_r": lo_exp, "high_n": hi["n"], "low_n": lo["n"]},
                    sample_size=hi["n"] + lo["n"],
                    priority=70,
                )
            )

    pbs = playbooks.get("playbooks", [])
    if pbs:
        best = max(pbs, key=lambda p: float(p.get("edge_quality", {}).get("score") or 0))
        if best["trade_count"] >= 5 and best.get("expectancy_r"):
            insights.append(
                _insight(
                    id="top_playbook_edge",
                    category="playbook",
                    severity="opportunity",
                    confidence=classify_confidence(best["trade_count"]).value.lower(),
                    title=f"Strongest playbook: {best['name']}",
                    finding=f"{best['name']} shows {best['expectancy_r']}R expectancy over {best['trade_count']} trades in your history.",
                    evidence={"playbook": best["name"], "expectancy_r": best["expectancy_r"], "edge_quality": best.get("edge_quality")},
                    sample_size=best["trade_count"],
                    priority=75,
                )
            )
        weak = [p for p in pbs if p.get("expectancy_r") and float(p["expectancy_r"]) < 0 and p["trade_count"] >= 5]
        if weak:
            w = min(weak, key=lambda p: float(p["expectancy_r"]))
            insights.append(
                _insight(
                    id="weak_playbook",
                    category="playbook",
                    severity="warning",
                    confidence=classify_confidence(w["trade_count"]).value.lower(),
                    title=f"Weakest playbook: {w['name']}",
                    finding=f"{w['name']} has underperformed your baseline historically ({w['expectancy_r']}R, n={w['trade_count']}).",
                    evidence={"playbook": w["name"], "expectancy_r": w["expectancy_r"]},
                    sample_size=w["trade_count"],
                    priority=65,
                )
            )

    weaknesses = edge_maps.get("weakness_map", [])
    if weaknesses:
        w = weaknesses[0]
        if w["n"] >= 5:
            insights.append(
                _insight(
                    id="weakness_combo",
                    category="performance",
                    severity="observation",
                    confidence=classify_confidence(w["n"]).value.lower(),
                    title="Recurring underperformance pattern",
                    finding=f"{w['setup']} on {w['symbol']} ({w['session']}) has historically underperformed ({w['expectancy_r']}R, n={w['n']}).",
                    evidence=w,
                    sample_size=w["n"],
                    priority=60,
                )
            )

    dq = decision_quality.get("counts", {})
    if dq.get("lucky_win", 0) >= 3:
        insights.append(
            _insight(
                id="lucky_wins",
                category="discipline",
                severity="info",
                confidence=classify_confidence(dq["lucky_win"]).value.lower(),
                title="Wins with poor process detected",
                finding=f"{dq['lucky_win']} winning trades were classified as poor process. Wins do not always mean good execution.",
                evidence=dq,
                sample_size=sum(dq.values()),
                priority=55,
            )
        )

    if improvement.get("available"):
        proc = improvement.get("process_change", {})
        perf = improvement.get("performance_change", {})
        disc_chg = proc.get("discipline_avg")
        pnl_chg = perf.get("net_pnl")
        if disc_chg and Decimal(str(disc_chg)) > 0:
            insights.append(
                _insight(
                    id="process_improving",
                    category="consistency",
                    severity="info",
                    confidence="moderate",
                    title="Process metrics improving",
                    finding=f"Discipline improved {disc_chg}% in the last window vs the prior window. Performance change: {pnl_chg or 'n/a'}.",
                    evidence={"process_change": proc, "performance_change": perf},
                    sample_size=improvement.get("current", {}).get("n", 0),
                    priority=50,
                )
            )

    return sorted(insights, key=lambda x: -x["priority"])
