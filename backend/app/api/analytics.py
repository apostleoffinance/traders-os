from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, http_error
from app.core.security import get_current_user_id, get_db
from app.services import analytics_service, auth_service, dashboard_service

dashboard_router = APIRouter(tags=["dashboard"])
analytics_router = APIRouter(prefix="/analytics", tags=["analytics"])
risk_router = APIRouter(prefix="/risk", tags=["risk"])


def _user(db, user_id):
    return auth_service.get_user(db, user_id)


@dashboard_router.get("/dashboard")
def get_dashboard(
    account_id: UUID = Query(...),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return dashboard_service.dashboard(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/dashboard")
def analytics_dashboard(
    account_id: UUID,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    symbol: str | None = None,
    session: str | None = None,
    setup_id: UUID | None = None,
    direction: str | None = None,
    timeframe: str | None = None,
    psychology: str | None = None,
    result: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return analytics_service.dashboard(
            db,
            _user(db, user_id),
            account_id,
            preset=preset,
            date_from=date_from,
            date_to=date_to,
            symbol=symbol,
            session=session,
            setup_id=setup_id,
            direction=direction,
            timeframe=timeframe,
            psychology=psychology,
            result=result,
        )
    except DomainError as exc:
        raise http_error(exc) from exc
    except ValueError as exc:
        raise http_error(DomainError(str(exc), "invalid_period")) from exc


@analytics_router.get("/edge-detail")
def edge_detail_route(
    account_id: UUID,
    symbol: str = Query(...),
    session: str = Query(...),
    setup: str | None = None,
    direction: str | None = None,
    preset: str = Query("all"),
    date_from: str | None = None,
    date_to: str | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return analytics_service.edge_explorer_detail(
            db,
            _user(db, user_id),
            account_id,
            symbol=symbol,
            session=session,
            setup=setup,
            direction=direction,
            preset=preset,
            date_from=date_from,
            date_to=date_to,
        )
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/overview")
def overview(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.overview(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/session")
def session(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.by_session(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/setup")
def setup(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.by_setup(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/direction")
def direction(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.by_direction(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/weekday")
def weekday(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.by_weekday(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/psychology")
def psychology(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.by_psychology(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/rr")
def rr(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.by_rr(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/timeframe")
def timeframe(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.by_timeframe(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/holding")
def holding(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.by_holding(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@analytics_router.get("/equity-curve")
def equity_curve(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.equity_curve(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@risk_router.get("/command")
def risk_command(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.risk_command(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@risk_router.get("/status")
def risk_status(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analytics_service.risk_status(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@risk_router.get("/daily")
def risk_daily(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        data = analytics_service.risk_status(db, _user(db, user_id), account_id)
        return {
            "daily_pnl": data["daily_pnl"],
            "daily_risk": data["daily_risk"],
            "trades_today": data["trades_today"],
            "distance_to_personal_daily_loss": data["distance_to_personal_daily_loss"],
            "distance_to_firm_daily_dd": data["distance_to_firm_daily_dd"],
            "status": data["status"],
            "reasons": data["reasons"],
        }
    except DomainError as exc:
        raise http_error(exc) from exc


@risk_router.get("/drawdown")
def risk_drawdown(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        data = analytics_service.risk_status(db, _user(db, user_id), account_id)
        return {
            "current_drawdown": data["current_drawdown"],
            "current_drawdown_pct": data["current_drawdown_pct"],
            "max_drawdown": data["max_drawdown"],
            "distance_to_personal_max_dd": data["distance_to_personal_max_dd"],
            "distance_to_firm_max_dd": data["distance_to_firm_max_dd"],
            "status": data["status"],
        }
    except DomainError as exc:
        raise http_error(exc) from exc
