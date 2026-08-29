"""Command Center intelligence — deterministic narratives from journal data."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Sequence
from zoneinfo import ZoneInfo

from app.core.enums import RiskStatus, TradeStatus
from app.core.time import as_utc
from app.engines.analytics_views import JournalTrade, closed_only, group_stats, r_of
from app.engines.evidence import evidence_payload
from app.engines.intelligence_feed import build_intelligence_feed, feed_to_command_center
from app.engines.fx_math import ZERO, money, ratio
from app.engines.risk_engine import ClosedTrade, RiskProfileView, RiskSnapshot
from app.models.trade import Trade


def _local_date(ts: datetime, timezone: str):
    return as_utc(ts).astimezone(ZoneInfo(timezone)).date()


def _today_trades(trades: Sequence[Trade], timezone: str, today) -> list[Trade]:
    return [t for t in trades if _local_date(t.trade_timestamp, timezone) == today]


def _status_label(risk_status: RiskStatus) -> str:
    if risk_status == RiskStatus.GREEN:
        return "STABLE"
    if risk_status == RiskStatus.YELLOW:
        return "CAUTION"
    return "HALT"


def _trading_capacity(
    profile: RiskProfileView,
    snap: RiskSnapshot,
) -> dict:
    risk_unit = profile.risk_per_trade
    remaining = snap.distance_to_personal_daily_loss
    if risk_unit <= ZERO or remaining <= ZERO:
        full = 0
        half = 0
    else:
        full = int(remaining // risk_unit)
        half = int(remaining // (risk_unit / Decimal("2")))
    used_daily = profile.personal_daily_loss_limit - snap.distance_to_personal_daily_loss
    daily_pct = (
        float(used_daily / profile.personal_daily_loss_limit * 100)
        if profile.personal_daily_loss_limit > ZERO
        else 0.0
    )
    return {
        "full_risk_trades_remaining": max(0, full),
        "half_risk_trades_remaining": max(0, half),
        "risk_per_trade": money(risk_unit),
        "daily_loss_used": money(used_daily),
        "daily_loss_limit": money(profile.personal_daily_loss_limit),
        "daily_loss_used_pct": round(min(100.0, max(0.0, daily_pct)), 1),
    }


def _timeline_for_today(today_trades: Sequence[Trade], timezone: str) -> list[dict]:
    events: list[dict] = []
    for t in sorted(today_trades, key=lambda x: as_utc(x.trade_timestamp)):
        ts = as_utc(t.trade_timestamp).astimezone(ZoneInfo(timezone))
        setup = t.setup.name if t.setup else None
        label = f"{t.symbol} {t.direction.upper()}"
        if t.status == TradeStatus.OPEN.value:
            events.append(
                {
                    "at": ts.isoformat(),
                    "type": "opened",
                    "trade_id": str(t.id),
                    "label": label,
                    "detail": setup or "Trade opened",
                    "severity": "info",
                    "symbol": t.symbol,
                }
            )
        else:
            events.append(
                {
                    "at": ts.isoformat(),
                    "type": "opened",
                    "trade_id": str(t.id),
                    "label": label,
                    "detail": "Position opened",
                    "severity": "info",
                    "symbol": t.symbol,
                }
            )
        if t.exit_timestamp:
            exit_ts = as_utc(t.exit_timestamp).astimezone(ZoneInfo(timezone))
            r_val = None
            if t.realized_r is not None:
                r_val = ratio(Decimal(t.realized_r))
            elif t.risk_amount and Decimal(t.risk_amount) > ZERO and t.realized_pnl is not None:
                r_val = ratio(Decimal(t.realized_pnl) / Decimal(t.risk_amount))
            result = t.result or "closed"
            sev = "success" if result == "win" else "warn" if result == "loss" else "info"
            detail = f"{result.upper()}"
            if r_val:
                detail += f" · {r_val}R"
            if not t.rules_followed:
                detail += " · rules not followed"
                sev = "warn"
            if t.emotional_trade:
                detail += " · emotional"
                sev = "warn"
            if not t.in_preferred_session:
                detail += " · outside session"
                sev = "warn"
            events.append(
                {
                    "at": exit_ts.isoformat(),
                    "type": "closed",
                    "trade_id": str(t.id),
                    "label": label,
                    "detail": detail,
                    "severity": sev,
                    "symbol": t.symbol,
                }
            )
    events.sort(key=lambda e: e["at"])
    return events


def _today_story(
    today_trades: Sequence[Trade],
    closed_views: Sequence[ClosedTrade],
    snap: RiskSnapshot,
    profile: RiskProfileView,
) -> dict:
    n = len(today_trades)
    closed_today = [t for t in today_trades if t.status == TradeStatus.CLOSED.value]
    bullets: list[dict] = []

    if n == 0:
        return {
            "trade_count": 0,
            "closed_count": 0,
            "discipline_avg": None,
            "headline": "No trades logged today yet.",
            "bullets": [],
        }

    disc_scores = [t.discipline_score for t in today_trades if t.discipline_score is not None]
    disc_avg = round(sum(disc_scores) / len(disc_scores)) if disc_scores else None

    wins = sum(1 for t in closed_today if t.result == "win")
    losses = sum(1 for t in closed_today if t.result == "loss")
    if closed_today:
        best = max(
            closed_today,
            key=lambda t: Decimal(t.realized_r or 0) if t.realized_r else Decimal(t.realized_pnl or 0),
        )
        if best.result == "win" and best.setup_id and best.setup:
            bullets.append(
                {
                    "tone": "positive",
                    "text": f"Your best trade followed {best.setup.name} ({best.symbol}).",
                }
            )

    if snap.consecutive_losses >= 2:
        bullets.append(
            {
                "tone": "warn",
                "text": f"You are on a {snap.consecutive_losses}-trade losing streak. Protect capital.",
            }
        )

    if snap.risk_escalation_pct and snap.risk_escalation_pct > Decimal("0.15"):
        pct = int(snap.risk_escalation_pct * 100)
        bullets.append(
            {
                "tone": "warn",
                "text": f"Recent average risk is {pct}% above your configured unit.",
            }
        )

    outside = [t for t in today_trades if not t.in_preferred_session]
    if outside:
        bullets.append(
            {
                "tone": "warn",
                "text": f"{len(outside)} trade(s) today were outside your preferred session.",
            }
        )

    emotional = [t for t in today_trades if t.emotional_trade]
    if emotional:
        bullets.append(
            {
                "tone": "warn",
                "text": f"{len(emotional)} trade(s) flagged as emotional today.",
            }
        )

    if profile.max_trades_per_day and snap.trades_today >= profile.max_trades_per_day:
        bullets.append(
            {
                "tone": "warn",
                "text": "You have reached your daily trade frequency limit.",
            }
        )

    if wins and not losses:
        headline = f"You took {n} trade{'s' if n != 1 else ''} today — all closed winners so far."
    elif n == 1:
        headline = "You took 1 trade today."
    else:
        headline = f"You took {n} trades today."

    return {
        "trade_count": n,
        "closed_count": len(closed_today),
        "discipline_avg": disc_avg,
        "headline": headline,
        "bullets": bullets[:5],
    }


def _edge_snapshot(journal: Sequence[JournalTrade], starting: Decimal) -> dict | None:
    if len(closed_only(journal)) < 5:
        return None
    sessions = group_stats(journal, starting, lambda t: t.session, "session")
    setups = group_stats(journal, starting, lambda t: t.setup, "setup")
    candidates = [r for r in sessions + setups if r["n"] >= 5 and r["expectancy_r"] is not None]
    if not candidates:
        return None
    best = max(candidates, key=lambda r: Decimal(r["expectancy_r"]))
    kind = "session" if best in sessions else "setup"
    return {
        "kind": kind,
        "label": best["key"],
        "expectancy_r": best["expectancy_r"],
        "win_rate": best["win_rate"],
        "n": best["n"],
        "evidence": best["evidence"],
        "insight": best["insight"],
    }


def _behaviour_watch(
    journal: Sequence[JournalTrade],
    closed_views: Sequence[ClosedTrade],
    snap: RiskSnapshot,
    profile: RiskProfileView,
    starting: Decimal,
) -> dict | None:
    if snap.risk_escalation_pct and snap.risk_escalation_pct >= Decimal("0.20"):
        return {
            "code": "risk_escalation",
            "severity": "warn",
            "title": "Risk escalation detected",
            "summary": (
                f"Your last trades averaged {money(snap.avg_risk_last_n or ZERO)} risk "
                f"vs {money(profile.risk_per_trade)} configured."
            ),
            "evidence": evidence_payload(len([t for t in closed_views if t.status == TradeStatus.CLOSED])),
        }

    psych_groups = group_stats(journal, starting, lambda t: t.emotion_before or "unknown", "psychology")
    fomo = next((g for g in psych_groups if g["key"].lower() == "fomo" and g["n"] >= 3), None)
    if fomo and fomo["expectancy_r"] is not None and Decimal(fomo["expectancy_r"]) < ZERO:
        return {
            "code": "fomo_drag",
            "severity": "warn",
            "title": "FOMO trades underperform",
            "summary": f"FOMO-tagged entries: {fomo['expectancy_r']}R expectancy over {fomo['n']} trades.",
            "evidence": fomo["evidence"],
        }

    if snap.consecutive_losses >= 3:
        return {
            "code": "loss_streak",
            "severity": "warn",
            "title": "Losing streak active",
            "summary": f"{snap.consecutive_losses} consecutive losses. Review process before sizing up.",
            "evidence": evidence_payload(snap.consecutive_losses),
        }

    return None


def _insights_feed(
    journal: Sequence[JournalTrade],
    snap: RiskSnapshot,
    edge: dict | None,
    behaviour: dict | None,
    perf_n: int,
    starting: Decimal,
    profile: RiskProfileView,
    closed_views: Sequence[ClosedTrade],
) -> list[dict]:
    payload = build_intelligence_feed(
        journal,
        closed_views,
        snap,
        profile,
        starting,
    )
    return feed_to_command_center(payload)[:5]


def build_command_center(
    trades: Sequence[Trade],
    journal: Sequence[JournalTrade],
    closed_views: Sequence[ClosedTrade],
    snap: RiskSnapshot,
    profile: RiskProfileView,
    starting: Decimal,
    timezone: str,
    now: datetime,
    perf_n: int,
) -> dict:
    today = _local_date(now, timezone)
    today_trades = _today_trades(trades, timezone, today)
    edge = _edge_snapshot(journal, starting)
    behaviour = _behaviour_watch(journal, closed_views, snap, profile, starting)
    return {
        "account_status": _status_label(snap.status),
        "trading_capacity": _trading_capacity(profile, snap),
        "today_story": _today_story(today_trades, closed_views, snap, profile),
        "timeline": _timeline_for_today(today_trades, timezone),
        "edge_snapshot": edge,
        "behaviour_watch": behaviour,
        "insights": _insights_feed(journal, snap, edge, behaviour, perf_n, starting, profile, closed_views),
    }
