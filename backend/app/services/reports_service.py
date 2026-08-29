"""Reports service — load trades and build Performance Intelligence Reports."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import DomainError
from app.engines.reports import PeriodResolutionError, build_performance_report, resolve_report_period
from app.models.user import User
from app.services.access import get_owned_account
from app.services.analytics_service import _apply_filters, _trades
from app.services.mapping import profile_view


def _source_counts(trades) -> dict:
    counts = {"manual": 0, "mt5": 0, "other": 0}
    for t in trades:
        src = (getattr(t, "source", None) or "manual").lower()
        if "mt5" in src:
            counts["mt5"] += 1
        elif src == "manual":
            counts["manual"] += 1
        else:
            counts["other"] += 1
    return counts


def _filter_trades(all_trades, *, timezone: str, start: datetime, end: datetime):
    return _apply_filters(
        all_trades,
        timezone=timezone,
        date_from=start,
        date_to=end,
    )


def generate_report(
    db: Session,
    user: User,
    account_id: UUID,
    *,
    report_type: str,
    year: int,
    month: int | None = None,
    quarter: int | None = None,
) -> dict:
    account = get_owned_account(db, user.id, account_id)
    try:
        period_meta = resolve_report_period(
            report_type,
            year=year,
            month=month,
            quarter=quarter,
            timezone=user.timezone,
        )
    except PeriodResolutionError as exc:
        raise DomainError(str(exc), "invalid_period") from exc

    all_trades = _trades(db, user.id, account.id)
    filtered = _filter_trades(
        all_trades,
        timezone=user.timezone,
        start=period_meta["start"],
        end=period_meta["end"],
    )
    previous = _filter_trades(
        all_trades,
        timezone=user.timezone,
        start=period_meta["previous"]["start"],
        end=period_meta["previous"]["end"],
    )

    profile = profile_view(account.risk_profile)
    starting = Decimal(account.starting_balance)

    return build_performance_report(
        filtered,
        previous,
        report_type=report_type,
        period_meta=period_meta,
        account={
            "id": str(account.id),
            "name": account.account_name,
            "currency": account.currency,
            "firm": account.firm,
            "starting_balance": str(starting),
        },
        starting=starting,
        configured_risk=profile.risk_per_trade,
        timezone=user.timezone,
        source_counts=_source_counts(filtered),
    )


def monthly(db, user, account_id, *, year: int, month: int) -> dict:
    return generate_report(db, user, account_id, report_type="monthly", year=year, month=month)


def quarterly(db, user, account_id, *, year: int, quarter: int) -> dict:
    return generate_report(db, user, account_id, report_type="quarterly", year=year, quarter=quarter)


def yearly(db, user, account_id, *, year: int) -> dict:
    return generate_report(db, user, account_id, report_type="yearly", year=year)


def interpret(
    db: Session,
    user: User,
    account_id: UUID,
    *,
    report_type: str,
    year: int,
    month: int | None = None,
    quarter: int | None = None,
    force: bool = False,
) -> dict:
    from app.ai import services as ai_services

    if report_type == "monthly":
        report = monthly(db, user, account_id, year=year, month=month)  # type: ignore[arg-type]
    elif report_type == "quarterly":
        report = quarterly(db, user, account_id, year=year, quarter=quarter)  # type: ignore[arg-type]
    else:
        report = yearly(db, user, account_id, year=year)
    interpretation = ai_services.report_intelligence(db, user, account_id, report, force=force)
    return {"report": report, "interpretation": interpretation}
