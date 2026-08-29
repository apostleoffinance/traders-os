"""Structured findings context for Performance Intelligence Report AI interpretation.

The deterministic report payload is authoritative — this module extracts only
evidence-backed findings for the LLM. No recalculation of trading metrics.
"""

from __future__ import annotations

from typing import Any

from app.engines.reports.constants import MIN_SAMPLE_SIZE_BASIC, MIN_SAMPLE_SIZE_RESEARCH


def _top_rows(rows: list[dict], *, key: str = "expectancy_r", limit: int = 5) -> list[dict]:
    eligible = [r for r in rows if int(r.get("n") or 0) >= MIN_SAMPLE_SIZE_BASIC]
    if not eligible:
        return []
    sorted_rows = sorted(
        eligible,
        key=lambda r: float(r.get(key) or 0) if r.get(key) is not None else -999.0,
        reverse=True,
    )
    out = []
    for r in sorted_rows[:limit]:
        out.append({
            "key": r.get("key"),
            "n": r.get("n"),
            "win_rate": r.get("win_rate"),
            "expectancy_r": r.get("expectancy_r"),
            "net_pnl": r.get("net_pnl"),
            "evidence_label": (r.get("evidence") or {}).get("label"),
        })
    return out


def _bottom_rows(rows: list[dict], *, key: str = "expectancy_r", limit: int = 3) -> list[dict]:
    eligible = [r for r in rows if int(r.get("n") or 0) >= MIN_SAMPLE_SIZE_RESEARCH and r.get(key) is not None]
    if not eligible:
        return []
    sorted_rows = sorted(eligible, key=lambda r: float(r.get(key) or 0))
    out = []
    for r in sorted_rows[:limit]:
        out.append({
            "key": r.get("key"),
            "n": r.get("n"),
            "expectancy_r": r.get("expectancy_r"),
            "net_pnl": r.get("net_pnl"),
        })
    return out


def _performance_findings(report: dict) -> list[dict]:
    perf = report.get("performance", {})
    kpis = perf.get("kpis", {})
    wl = perf.get("win_loss", {})
    findings: list[dict] = []

    n = wl.get("n", 0)
    if n:
        findings.append({"topic": "sample", "n": n, "win_rate": wl.get("win_rate"), "note": wl.get("sample_note")})

    for label, block in [
        ("net_pnl", kpis.get("net_pnl", {})),
        ("expectancy_r", kpis.get("expectancy_r", {})),
        ("profit_factor", kpis.get("profit_factor", {})),
        ("average_r", kpis.get("average_r", {})),
        ("max_drawdown_pct", perf.get("equity_curve", {}).get("drawdown", {}).get("max_drawdown_pct")),
    ]:
        if isinstance(block, dict) and block.get("value") is not None:
            findings.append({"topic": label, "value": block.get("value"), "note": block.get("note")})
        elif block is not None and label == "max_drawdown_pct":
            findings.append({"topic": label, "value": block})

    streaks = perf.get("streaks", {})
    longest = streaks.get("longest", {})
    if longest:
        findings.append({
            "topic": "streaks",
            "longest_wins": longest.get("wins"),
            "longest_losses": longest.get("losses"),
        })
    return findings


def _risk_findings(report: dict) -> list[dict]:
    risk = report.get("risk", {})
    findings: list[dict] = []
    analytics = risk.get("analytics", {})
    if analytics:
        summary = analytics.get("summary", {})
        for k in ("max_risk_per_trade", "avg_planned_risk", "avg_actual_risk", "max_drawdown", "recovery_factor"):
            if summary.get(k) is not None:
                findings.append({"topic": k, "value": summary.get(k)})

    policy = risk.get("policy", {})
    cats = policy.get("categories") or []
    violations = next((c for c in cats if c.get("category") == "POLICY_VIOLATION"), None)
    if violations:
        findings.append({"topic": "policy_violations", "n": violations.get("n", 0)})

    qd = risk.get("quant_drawdown", {})
    block = (qd or {}).get("currency_block") or {}
    if block.get("max_drawdown"):
        findings.append({"topic": "max_drawdown", "value": block.get("max_drawdown")})
    return findings


def _behavior_findings(report: dict) -> list[dict]:
    intel = report.get("behavior", {})
    if not intel:
        return []
    findings: list[dict] = []
    meta = intel.get("metadata", {})
    if meta:
        findings.append({
            "topic": "sample",
            "trades_analyzed": meta.get("trades_analyzed"),
            "confidence": (meta.get("confidence") or {}).get("confidence_level"),
        })

    beh = intel.get("behaviour", {}) or intel.get("behavior", {})
    revenge = beh.get("revenge_trading", {}) if beh else {}
    if revenge.get("risk_multiplier_after_loss_pct") is not None:
        findings.append({
            "topic": "risk_after_loss",
            "risk_multiplier_after_loss_pct": revenge.get("risk_multiplier_after_loss_pct"),
            "post_loss_trade_count": revenge.get("post_loss_trade_count"),
        })

    discipline = intel.get("discipline", {})
    if discipline.get("overall_score") is not None:
        findings.append({"topic": "discipline_score", "value": discipline.get("overall_score")})

    segments = intel.get("segments", {})
    if segments.get("outside_session"):
        findings.append({"topic": "outside_session_trades", "n": segments.get("outside_session")})

    insights = intel.get("insights") or []
    for ins in insights[:5]:
        findings.append({
            "topic": "insight",
            "category": ins.get("category"),
            "title": ins.get("title"),
            "finding": ins.get("finding"),
            "sample_size": ins.get("sample_size"),
            "confidence": ins.get("confidence"),
        })
    return findings


def _execution_findings(report: dict) -> list[dict]:
    execution = report.get("execution", {})
    findings: list[dict] = []
    exit_eff = execution.get("exit_efficiency", {})
    if exit_eff.get("available"):
        findings.append({
            "topic": "exit_efficiency",
            "median_capture_pct": exit_eff.get("median_capture_pct"),
            "n_with_mfe": exit_eff.get("n_with_mfe"),
        })
    mfe = execution.get("mfe_mae", {})
    if mfe.get("available"):
        summary = mfe.get("summary", {})
        for k in ("avg_mfe_r", "avg_mae_r", "median_mfe_r", "median_mae_r"):
            if summary.get(k) is not None:
                findings.append({"topic": k, "value": summary.get(k)})
    return findings


def _playbook_findings(report: dict) -> list[dict]:
    pb = report.get("playbooks", {})
    findings: list[dict] = []
    best = pb.get("best_playbook")
    if best and best.get("label"):
        findings.append({
            "topic": "best_playbook",
            "label": best.get("label"),
            "n": best.get("n"),
            "expectancy_r": best.get("expectancy_r"),
            "disclaimer": best.get("disclaimer"),
        })
    ranked = pb.get("ranked") or pb.get("playbooks") or []
    for row in ranked[:3]:
        findings.append({
            "topic": "ranked_playbook",
            "label": row.get("label") or row.get("key"),
            "n": row.get("n"),
            "expectancy_r": row.get("expectancy_r"),
        })
    return findings


def _comparison_findings(report: dict) -> list[dict]:
    comp = report.get("comparison")
    if not comp or not comp.get("available"):
        return []
    return [
        {
            "metric": row.get("metric"),
            "current": row.get("current"),
            "previous": row.get("previous"),
            "absolute": row.get("absolute"),
            "benefit": row.get("benefit"),
        }
        for row in comp.get("rows", [])
    ]


def _decision_quality_summary(report: dict) -> dict:
    dq = report.get("decision_quality", {})
    counts = dq.get("counts", {})
    labels = dq.get("labels", {})
    return {
        "counts": counts,
        "labels": labels,
        "note": "Process quality is separate from profitability.",
    }


def build_report_ai_context(report: dict) -> dict[str, Any]:
    """Extract structured findings for LLM interpretation — metrics are read-only."""
    edge = report.get("edge", {})
    return {
        "report_id": report.get("report", {}).get("id"),
        "report_type": report.get("report", {}).get("type"),
        "period_label": report.get("period", {}).get("label"),
        "timezone": report.get("period", {}).get("timezone"),
        "account_name": report.get("account", {}).get("name"),
        "confidence": report.get("confidence"),
        "data_quality": {
            "completeness_pct": report.get("data_quality", {}).get("completeness_pct"),
            "missing": (report.get("data_quality", {}).get("missing") or [])[:8],
            "sources": report.get("data_quality", {}).get("sources"),
        },
        "scorecard": report.get("executive_summary", {}).get("scorecard"),
        "performance_status": report.get("executive_summary", {}).get("status"),
        "narrative_seed": report.get("executive_summary", {}).get("narrative_seed"),
        "performance_findings": _performance_findings(report),
        "risk_findings": _risk_findings(report),
        "behavior_findings": _behavior_findings(report),
        "edge_findings": {
            "top_instruments": _top_rows(edge.get("instruments", [])),
            "weak_instruments": _bottom_rows(edge.get("instruments", [])),
            "top_setups": _top_rows(edge.get("setups", [])),
            "weak_setups": _bottom_rows(edge.get("setups", [])),
            "sessions": _top_rows(edge.get("sessions", [])),
        },
        "execution_findings": _execution_findings(report),
        "playbook_findings": _playbook_findings(report),
        "comparison_findings": _comparison_findings(report),
        "decision_quality": _decision_quality_summary(report),
        "deterministic_recommendations": report.get("recommendations"),
        "guardrails": {
            "min_sample_basic": MIN_SAMPLE_SIZE_BASIC,
            "min_sample_research": MIN_SAMPLE_SIZE_RESEARCH,
            "instruction": "Never invent metrics. Cite evidence from findings only. Process focus only.",
        },
    }
