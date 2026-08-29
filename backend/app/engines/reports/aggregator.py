"""Assemble Performance Intelligence Report from deterministic engines."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Sequence

from app.core.time import as_utc
from app.engines.analytics_lab.builder import build_analytics_lab
from app.engines.analytics_lab.decision_quality import build_decision_quality
from app.engines.analytics_lab.playbook_intel import build_playbook_intelligence
from app.engines.analytics_lab.trade_row import AnalyticsTrade, closed_trades, trade_to_analytics
from app.engines.analytics_views import calendar_days, monthly_bars, streak_histogram
from app.engines.discipline_engine import aggregate_discipline
from app.engines.quant_lab.drawdown import build_drawdown
from app.engines.reports.comparison import build_period_comparison
from app.engines.reports.confidence import confidence_payload
from app.engines.reports.constants import REPORT_VERSION
from app.engines.reports.data_quality import build_data_quality
from app.engines.reports.executive_summary import build_executive_summary
from app.engines.reports.recommendations import build_recommendations
from app.engines.reports.status import classify_performance_status
from app.models.trade import Trade


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _discipline_avg(trades: Sequence[AnalyticsTrade]) -> int | None:
    scores = [t.discipline_score for t in closed_trades(list(trades)) if t.discipline_score is not None]
    if not scores:
        return None
    return int(round(sum(scores) / len(scores)))


def _risk_violation_count(lab: dict) -> int:
    cats = lab.get("intelligence", {}).get("discipline", {}).get("risk_adherence", {}).get("categories", [])
    for c in cats:
        if c.get("category") == "POLICY_VIOLATION":
            return int(c.get("n") or 0)
    return 0


def _emotional_count(trades: Sequence[AnalyticsTrade]) -> int:
    return sum(1 for t in closed_trades(list(trades)) if t.emotional_trade)


def _trade_highlights(performance: dict) -> dict:
    bt = performance.get("best_trades", {})
    return {
        "best": bt.get("winners", [])[:5],
        "worst": bt.get("losers", [])[:5],
    }


def _yearly_timeline(lab: dict, *, timezone: str) -> list[dict]:
    monthly = lab.get("temporal", {}).get("monthly", {}).get("rows", [])
    return monthly


def build_performance_report(
    trades: Sequence[Trade],
    previous_trades: Sequence[Trade] | None,
    *,
    report_type: str,
    period_meta: dict,
    account: dict,
    starting: Decimal,
    configured_risk: Decimal | None,
    timezone: str,
    source_counts: dict | None = None,
) -> dict:
    """Build full report payload — single source of truth for frontend."""
    rows = [trade_to_analytics(t) for t in trades]
    prev_rows = [trade_to_analytics(t) for t in previous_trades] if previous_trades else []
    closed = closed_trades(rows)
    n = len(closed)

    period_label = period_meta["label"]
    lab = build_analytics_lab(
        trades,
        starting=starting,
        timezone=timezone,
        filters={"report": True},
        period=period_label,
        previous_trades=list(previous_trades) if previous_trades else None,
        configured_risk=configured_risk,
    )
    prev_lab = None
    if previous_trades:
        prev_lab = build_analytics_lab(
            list(previous_trades),
            starting=starting,
            timezone=timezone,
            filters={"report": True},
            period=period_meta["previous"]["label"],
            configured_risk=configured_risk,
        )

    from app.engines.analytics_lab.trade_row import journal_rows

    journals = journal_rows(rows)
    dq = build_data_quality(rows)
    if source_counts:
        dq["sources"] = source_counts

    discipline_score = _discipline_avg(rows)
    disc_agg = aggregate_discipline([t.discipline_score for t in closed if t.discipline_score is not None]) if closed else None

    perf = lab["performance"]
    kpis = perf.get("kpis", {})
    dd_pct = lab.get("equity", {}).get("drawdown", {}).get("max_drawdown_pct")

    status = classify_performance_status(
        n=n,
        net_pnl=Decimal(str(kpis.get("net_pnl", {}).get("value") or 0)) if kpis.get("net_pnl") else None,
        expectancy_r=Decimal(str(kpis.get("expectancy_r", {}).get("value"))) if kpis.get("expectancy_r", {}).get("value") else None,
        profit_factor=Decimal(str(kpis.get("profit_factor", {}).get("value"))) if kpis.get("profit_factor", {}).get("value") else None,
        max_drawdown_pct=Decimal(str(dd_pct)) if dd_pct else None,
        discipline_score=discipline_score,
        risk_violations=_risk_violation_count(lab),
        emotional_trades=_emotional_count(rows),
    )

    comparison = None
    if prev_lab and report_type in ("quarterly", "yearly", "monthly"):
        comparison = build_period_comparison(perf, prev_lab["performance"])
        if report_type == "monthly":
            comparison["label"] = f"{period_label} vs {period_meta['previous']['label']}"

    executive = build_executive_summary(
        performance=perf,
        discipline_score=discipline_score,
        starting_balance=starting,
        currency=account.get("currency", "USD"),
        status=status,
    )

    quant_dd = build_drawdown(rows, starting=starting) if rows else None

    report_id = f"{account['id']}-{report_type}-{period_meta['period_key']}"

    payload = {
        "version": REPORT_VERSION,
        "report": {
            "id": report_id,
            "type": report_type,
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "status": "complete",
        },
        "period": {
            "label": period_label,
            "period_key": period_meta["period_key"],
            "start": _iso(period_meta["start"]),
            "end": _iso(period_meta["end"]),
            "timezone": timezone,
            "previous": {
                "label": period_meta["previous"]["label"],
                "start": _iso(period_meta["previous"]["start"]),
                "end": _iso(period_meta["previous"]["end"]),
            },
        },
        "account": account,
        "executive_summary": executive,
        "performance": {
            **perf,
            "equity_curve": lab.get("equity", {}),
            "calendar": calendar_days(journals, timezone),
            "monthly_bars": monthly_bars(journals, starting, timezone),
            "distributions": lab.get("distributions", {}),
            "streaks": lab.get("streaks", {}),
            "streak_timeline": streak_histogram(journals),
            "consistency": lab.get("consistency", {}),
        },
        "edge": lab.get("edge", {}),
        "execution": lab.get("execution", {}),
        "costs": lab.get("costs", {}),
        "risk": {
            "analytics": lab.get("risk_analytics", {}),
            "quant_drawdown": quant_dd,
            "policy": lab.get("intelligence", {}).get("discipline", {}).get("risk_adherence", {}),
        },
        "behavior": lab.get("intelligence", {}),
        "playbooks": build_playbook_intelligence(rows, starting=starting),
        "decision_quality": build_decision_quality(rows),
        "trade_highlights": _trade_highlights(perf),
        "comparison": comparison,
        "recommendations": build_recommendations(lab=lab, comparison=comparison, n=n),
        "data_quality": dq,
        "confidence": confidence_payload(n, completeness_pct=dq.get("completeness_pct")),
        "temporal": lab.get("temporal", {}),
    }

    if report_type == "yearly":
        payload["year_in_review"] = {
            "monthly_timeline": _yearly_timeline(lab, timezone=timezone),
            "title": "YOUR TRADING YEAR IN REVIEW",
            "best_month": _best_worst_month(lab),
        }

    if report_type == "quarterly":
        payload["quarterly_focus"] = {
            "question": "Am I improving?",
            "comparison": comparison,
        }

    return payload


def _best_worst_month(lab: dict) -> dict:
    rows = lab.get("temporal", {}).get("monthly", {}).get("rows", [])
    if not rows:
        return {"best": None, "worst": None}
    with_pnl = [r for r in rows if r.get("net_pnl") is not None]
    if not with_pnl:
        return {"best": None, "worst": None}
    best = max(with_pnl, key=lambda r: Decimal(str(r["net_pnl"])))
    worst = min(with_pnl, key=lambda r: Decimal(str(r["net_pnl"])))
    return {"best": best, "worst": worst}
