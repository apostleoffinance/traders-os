"""Intelligence Feed v2 — deterministic insights with evidence and actions."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Sequence
from zoneinfo import ZoneInfo

from app.core.enums import RiskStatus, TradeStatus
from app.core.time import as_utc
from app.engines.analytics_views import (
    JournalTrade,
    after_consecutive_losses,
    closed_only,
    group_stats,
)
from app.engines.discipline_engine import aggregate_discipline
from app.engines.evidence import evidence_payload
from app.engines.fx_math import ZERO, money, ratio
from app.engines.performance_engine import MIN_INSIGHT_N
from app.engines.risk_engine import ClosedTrade, RiskProfileView, RiskSnapshot


def _item(
    *,
    id: str,
    category: str,
    type: str,
    severity: str,
    title: str,
    summary: str,
    why: str,
    evidence: dict,
    comparison: dict | None = None,
    action: dict | None = None,
    priority: int = 50,
) -> dict:
    return {
        "id": id,
        "category": category,
        "type": type,
        "severity": severity,
        "title": title,
        "summary": summary,
        "why": why,
        "evidence": evidence,
        "comparison": comparison,
        "action": action,
        "priority": priority,
    }


def _eligible(rows: list[dict]) -> list[dict]:
    return [r for r in rows if int(r.get("n") or 0) >= MIN_INSIGHT_N and r.get("expectancy_r") is not None]


def feed_to_command_center(payload: dict) -> list[dict]:
    combined = payload.get("today", []) + payload.get("insights", [])
    ranked = sorted(combined, key=lambda x: -x["priority"])
    return [
        {
            "type": i["type"],
            "severity": i["severity"],
            "title": i["title"],
            "summary": i["summary"],
            "evidence": i["evidence"],
        }
        for i in ranked
    ]


def build_intelligence_feed(
    journal: Sequence[JournalTrade],
    closed_views: Sequence[ClosedTrade],
    snap: RiskSnapshot,
    profile: RiskProfileView,
    starting: Decimal,
    *,
    today_journal: Sequence[JournalTrade] | None = None,
) -> dict:
    today: list[dict] = []
    insights: list[dict] = []
    closed = closed_only(journal)
    perf_n = len(closed)

    # --- Today (calendar day, independent of period filter) ---
    if today_journal:
        today_closed = [t for t in today_journal if t.status == TradeStatus.CLOSED]
        if today_journal:
            n = len(today_journal)
            today.append(
                _item(
                    id="today-activity",
                    category="today",
                    type="TODAY",
                    severity="info",
                    title=f"{n} trade{'s' if n != 1 else ''} logged today",
                    summary=(
                        f"{len(today_closed)} closed"
                        if today_closed
                        else "Open position(s) still running."
                    ),
                    why="Counts trades with today's entry date in your timezone.",
                    evidence=evidence_payload(n),
                    action={"label": "View command center", "href": "/dashboard"},
                    priority=70,
                )
            )
        if snap.daily_pnl != ZERO:
            tone = "positive" if snap.daily_pnl > ZERO else "warn"
            today.append(
                _item(
                    id="today-pnl",
                    category="today",
                    type="TODAY",
                    severity=tone,
                    title=f"Today P/L: {money(snap.daily_pnl)}",
                    summary=(
                        "Green day so far." if snap.daily_pnl > ZERO else "Red day — protect remaining daily risk budget."
                    ),
                    why="Sum of realized P/L on trades closed today.",
                    evidence=evidence_payload(max(1, len(today_closed))),
                    action={"label": "Open Risk Command", "href": "/risk"},
                    priority=85,
                )
            )
        disc_today = [t.discipline_score for t in today_closed if t.discipline_score is not None]
        if disc_today:
            avg = int(round(sum(disc_today) / len(disc_today)))
            today.append(
                _item(
                    id="today-discipline",
                    category="today",
                    type="DISCIPLINE",
                    severity="positive" if avg >= 75 else "info",
                    title=f"Discipline today: {avg}/100",
                    summary=f"Average across {len(disc_today)} closed trade(s) today.",
                    why="Per-trade discipline scores averaged for today's closed trades.",
                    evidence=evidence_payload(len(disc_today)),
                    priority=60,
                )
            )

    # --- Risk (account state) ---
    if snap.status == RiskStatus.RED:
        insights.append(
            _item(
                id="risk-halt",
                category="risk",
                type="RISK",
                severity="danger",
                title="Risk policy halt",
                summary=snap.reasons[0] if snap.reasons else "Stand down until limits reset.",
                why="Account risk engine returned RED status from configured personal and firm limits.",
                evidence=evidence_payload(perf_n),
                action={"label": "Open Risk Command", "href": "/risk"},
                priority=100,
            )
        )
    elif snap.status == RiskStatus.YELLOW:
        insights.append(
            _item(
                id="risk-caution",
                category="risk",
                type="RISK",
                severity="warn",
                title="Approaching a risk limit",
                summary=snap.reasons[0] if snap.reasons else "Size down or skip marginal setups.",
                why="One or more limits crossed the caution threshold (typically 70% utilized).",
                evidence=evidence_payload(perf_n),
                action={"label": "Review limits", "href": "/risk"},
                priority=95,
            )
        )

    if snap.risk_escalation_pct and snap.risk_escalation_pct >= Decimal("0.20"):
        pct = int(snap.risk_escalation_pct * 100)
        insights.append(
            _item(
                id="risk-escalation",
                category="risk",
                type="RISK",
                severity="warn",
                title="Risk escalation detected",
                summary=(
                    f"Recent average risk {money(snap.avg_risk_last_n or ZERO)} "
                    f"vs {money(profile.risk_per_trade)} configured (+{pct}%)."
                ),
                why="Compares average risk on your last trades to your configured risk-per-trade unit.",
                evidence=evidence_payload(perf_n),
                comparison={
                    "baseline": "configured risk unit",
                    "subject": "recent average",
                    "subject_value": money(snap.avg_risk_last_n or ZERO),
                    "baseline_value": money(profile.risk_per_trade),
                },
                action={"label": "View risk signals", "href": "/risk"},
                priority=92,
            )
        )

    if snap.consecutive_losses >= 3:
        insights.append(
            _item(
                id="loss-streak",
                category="behaviour",
                type="BEHAVIOUR",
                severity="warn",
                title="Losing streak active",
                summary=f"{snap.consecutive_losses} consecutive losses. Review process before sizing up.",
                why="Counts closed trades in chronological order until the streak breaks.",
                evidence=evidence_payload(snap.consecutive_losses),
                action={"label": "Review journal", "href": "/trades"},
                priority=88,
            )
        )

    # --- Edge & session ---
    sessions = group_stats(journal, starting, lambda t: t.session, "session")
    setups = group_stats(journal, starting, lambda t: t.setup, "setup")
    sess_eligible = _eligible(sessions)

    if sess_eligible:
        best = max(sess_eligible, key=lambda r: Decimal(str(r["expectancy_r"])))
        insights.append(
            _item(
                id=f"edge-session-{best['key']}",
                category="edge",
                type="EDGE",
                severity="positive",
                title=f"Edge confirmed in {best['key']}",
                summary=f"{best['expectancy_r']}R expectancy over {best['n']} trades in this session.",
                why=f"Highest session expectancy among buckets with at least {MIN_INSIGHT_N} trades.",
                evidence=best["evidence"],
                comparison={
                    "baseline": "other sessions",
                    "subject": best["key"],
                    "subject_value": f"{best['expectancy_r']}R",
                    "baseline_value": "varies",
                },
                action={"label": "Explore in Edge Explorer", "href": "/analytics?tab=edge"},
                priority=80,
            )
        )

    if len(sess_eligible) >= 2:
        best = max(sess_eligible, key=lambda r: Decimal(str(r["expectancy_r"])))
        rest = [s for s in sess_eligible if s["key"] != best["key"]]
        worst = min(rest, key=lambda r: Decimal(str(r["expectancy_r"])))
        delta = Decimal(str(best["expectancy_r"])) - Decimal(str(worst["expectancy_r"]))
        if delta >= Decimal("0.25"):
            insights.append(
                _item(
                    id="session-compare",
                    category="edge",
                    type="SESSION",
                    severity="info",
                    title=f"{best['key']} outperforms {worst['key']}",
                    summary=(
                        f"{best['key']}: {best['expectancy_r']}R vs "
                        f"{worst['key']}: {worst['expectancy_r']}R expectancy."
                    ),
                    why="Compares session buckets that meet the minimum sample size for inference.",
                    evidence=best["evidence"],
                    comparison={
                        "baseline": worst["key"],
                        "subject": best["key"],
                        "subject_value": f"{best['expectancy_r']}R",
                        "baseline_value": f"{worst['expectancy_r']}R",
                    },
                    action={"label": "Session breakdown", "href": "/analytics?tab=behaviour"},
                    priority=75,
                )
            )

    setups_eligible = _eligible(setups)
    if setups_eligible:
        best_setup = max(setups_eligible, key=lambda r: (Decimal(str(r["expectancy_r"])), r["n"]))
        insights.append(
            _item(
                id=f"edge-setup-{best_setup['key']}",
                category="edge",
                type="EDGE",
                severity="positive",
                title=f"Strongest setup: {best_setup['key']}",
                summary=f"{best_setup['expectancy_r']}R expectancy across {best_setup['n']} trades.",
                why=f"Highest setup expectancy among classified setups with n≥{MIN_INSIGHT_N}.",
                evidence=best_setup["evidence"],
                action={"label": "Setup analytics", "href": "/analytics?tab=performance"},
                priority=72,
            )
        )

    # --- Behaviour / psychology ---
    psych = group_stats(journal, starting, lambda t: t.emotion_before or "unknown", "psychology")
    for row in _eligible(psych):
        key = str(row["key"]).lower()
        exp = Decimal(str(row["expectancy_r"]))
        if key in {"fomo", "revenge", "frustrated", "anxious"} and exp < ZERO:
            insights.append(
                _item(
                    id=f"psych-{key}",
                    category="behaviour",
                    type="BEHAVIOUR",
                    severity="warn",
                    title=f"{key.upper()} trades underperform",
                    summary=f"{row['expectancy_r']}R expectancy over {row['n']} {key}-tagged entries.",
                    why="Groups trades by emotion-before tag and compares historical expectancy.",
                    evidence=row["evidence"],
                    action={"label": "Behaviour lab", "href": "/analytics?tab=behaviour"},
                    priority=70,
                )
            )

    after_loss = after_consecutive_losses(journal, starting, 2)
    if int(after_loss.get("n") or 0) >= MIN_INSIGHT_N and after_loss.get("expectancy_r") is not None:
        exp = Decimal(str(after_loss["expectancy_r"]))
        if exp < ZERO:
            insights.append(
                _item(
                    id="after-losses",
                    category="behaviour",
                    type="BEHAVIOUR",
                    severity="warn",
                    title="Performance drops after losses",
                    summary=f"{after_loss['expectancy_r']}R expectancy on trades taken after 2+ consecutive losses.",
                    why="Selects trades that immediately follow a 2-loss streak in chronological order.",
                    evidence=after_loss["evidence"],
                    action={"label": "Review trades", "href": "/trades"},
                    priority=68,
                )
            )

    emotional_n = sum(1 for t in closed_views if t.emotional)
    if emotional_n >= 3:
        insights.append(
            _item(
                id="emotional-trades",
                category="behaviour",
                type="BEHAVIOUR",
                severity="warn",
                title="Emotional trades flagged",
                summary=f"{emotional_n} trades marked emotional in this period.",
                why="Counts trades you flagged as emotionally driven at entry.",
                evidence=evidence_payload(emotional_n),
                action={"label": "Behaviour lab", "href": "/analytics?tab=behaviour"},
                priority=62,
            )
        )

    # --- Discipline ---
    if perf_n >= MIN_INSIGHT_N:
        disc_scores = [t.discipline_score for t in closed if t.discipline_score is not None]
        if disc_scores:
            avg_d = aggregate_discipline(disc_scores) or int(round(sum(disc_scores) / len(disc_scores)))
            insights.append(
                _item(
                    id="discipline-avg",
                    category="discipline",
                    type="DISCIPLINE",
                    severity="positive" if avg_d >= 75 else "info",
                    title="Discipline snapshot",
                    summary=f"Average discipline score {avg_d}/100 across the selected period.",
                    why="Mean of per-trade discipline scores (independent of P/L).",
                    evidence=evidence_payload(len(disc_scores)),
                    action={"label": "Analytics overview", "href": "/analytics?tab=overview"},
                    priority=55,
                )
            )

    # --- Frequency ---
    if profile.max_trades_per_day and snap.trades_today >= profile.max_trades_per_day:
        insights.append(
            _item(
                id="frequency-cap",
                category="risk",
                type="RISK",
                severity="warn",
                title="Daily trade limit reached",
                summary=f"{snap.trades_today} / {profile.max_trades_per_day} trades today.",
                why="Compares today's trade count to max_trades_per_day on your risk profile.",
                evidence=evidence_payload(snap.trades_today),
                action={"label": "Risk Command", "href": "/risk"},
                priority=90,
            )
        )

    insights.sort(key=lambda x: -x["priority"])
    today.sort(key=lambda x: -x["priority"])

    return {"today": today, "insights": insights}
