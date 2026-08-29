from __future__ import annotations

from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.time import as_utc, utcnow
from app.engines.intelligence_feed import build_intelligence_feed
from app.engines.risk_engine import compute_risk_snapshot
from app.models.user import User
from app.services.access import get_owned_account
from app.services.analytics_service import _apply_filters, _trades, resolve_date_window
from app.services.mapping import profile_view, trade_to_closed, trade_to_journal


def _today_journal(trades, timezone: str, now) -> list:
    tz = ZoneInfo(timezone)
    today = now.astimezone(tz).date()
    out = []
    for t in trades:
        if as_utc(t.trade_timestamp).astimezone(tz).date() == today:
            out.append(trade_to_journal(t))
    return out


def intelligence_feed(
    db: Session,
    user: User,
    account_id: UUID,
    *,
    preset: str = "30d",
) -> dict:
    account = get_owned_account(db, user.id, account_id)
    all_trades = _trades(db, user.id, account_id)
    now = utcnow()
    start, end, resolved = resolve_date_window(preset, None, None, user.timezone, now=now)
    filtered = _apply_filters(
        all_trades,
        timezone=user.timezone,
        date_from=start,
        date_to=end,
        symbol=None,
        session=None,
        setup_id=None,
        direction=None,
        timeframe=None,
        psychology=None,
        result=None,
    )
    journal = [trade_to_journal(t) for t in filtered]
    closed_views = [trade_to_closed(t) for t in filtered]
    profile = profile_view(account.risk_profile)
    snap = compute_risk_snapshot(
        starting_balance=Decimal(account.starting_balance),
        profile=profile,
        trades=[trade_to_closed(t) for t in all_trades],
        now=now,
        timezone=user.timezone,
    )
    today_journal = _today_journal(all_trades, user.timezone, now)
    feed = build_intelligence_feed(
        journal,
        closed_views,
        snap,
        profile,
        Decimal(account.starting_balance),
        today_journal=today_journal,
    )
    all_insights = feed["today"] + feed["insights"]
    return {
        "account": {
            "id": str(account.id),
            "name": account.account_name,
            "firm": account.firm,
            "currency": account.currency,
        },
        "filters": {
            "preset": resolved,
            "date_from": start.isoformat() if start else None,
            "date_to": end.isoformat() if end else None,
        },
        "summary": {
            "total": len(all_insights),
            "today_count": len(feed["today"]),
            "positive": sum(1 for i in all_insights if i["severity"] == "positive"),
            "warnings": sum(1 for i in all_insights if i["severity"] in {"warn", "danger"}),
        },
        "feed": feed,
    }
