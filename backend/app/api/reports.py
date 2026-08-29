"""Performance Intelligence Report API."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, http_error
from app.core.security import get_current_user_id, get_db
from app.services import auth_service, reports_service

reports_router = APIRouter(prefix="/reports", tags=["reports"])


def _user(db, user_id):
    return auth_service.get_user(db, user_id)


def _call(fn, db, user_id, account_id, **kwargs):
    try:
        return fn(db, _user(db, user_id), account_id, **kwargs)
    except DomainError as exc:
        raise http_error(exc) from exc


@reports_router.get("/monthly")
def monthly_report(
    account_id: UUID = Query(...),
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(reports_service.monthly, db, user_id, account_id, year=year, month=month)


@reports_router.get("/quarterly")
def quarterly_report(
    account_id: UUID = Query(...),
    year: int = Query(..., ge=2020, le=2100),
    quarter: int = Query(..., ge=1, le=4),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(reports_service.quarterly, db, user_id, account_id, year=year, quarter=quarter)


@reports_router.get("/yearly")
def yearly_report(
    account_id: UUID = Query(...),
    year: int = Query(..., ge=2020, le=2100),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return _call(reports_service.yearly, db, user_id, account_id, year=year)


@reports_router.get("/interpret")
def interpret_report(
    account_id: UUID = Query(...),
    report_type: str = Query(..., pattern="^(monthly|quarterly|yearly)$"),
    year: int = Query(..., ge=2020, le=2100),
    month: int | None = Query(None, ge=1, le=12),
    quarter: int | None = Query(None, ge=1, le=4),
    force: bool = Query(False),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    """Generate deterministic report + AI interpretation. Metrics remain server-computed."""
    try:
        user = _user(db, user_id)
        if report_type == "monthly" and month is None:
            raise DomainError("month is required for monthly reports", "invalid_period")
        if report_type == "quarterly" and quarter is None:
            raise DomainError("quarter is required for quarterly reports", "invalid_period")
        return reports_service.interpret(
            db,
            user,
            account_id,
            report_type=report_type,
            year=year,
            month=month,
            quarter=quarter,
            force=force,
        )
    except DomainError as exc:
        raise http_error(exc) from exc
