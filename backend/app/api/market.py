from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, http_error
from app.core.security import get_current_user_id, get_db
from app.market_data import service as market_service
from app.market_data.ticker import get_ticker, market_status
from app.schemas.market import (
    AnalysisIn,
    AnalysisOut,
    AnalysisUpdate,
    AnnotationIn,
    AnnotationOut,
    SizeIn,
    TradePlanIn,
)
from app.services import analysis_service, auth_service

router = APIRouter(prefix="/market", tags=["market"])


def _user(db: Session, user_id: UUID):
    return auth_service.get_user(db, user_id)


@router.get("/instruments")
def instruments(user_id=Depends(get_current_user_id)):
    return {"instruments": market_service.list_instruments()}


@router.get("/ohlcv")
def ohlcv(
    symbol: str,
    timeframe: str = "M15",
    limit: int = Query(default=500, ge=10, le=1500),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return market_service.get_ohlcv(db, symbol, timeframe, limit=limit)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("/quote")
def quote(symbol: str, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return market_service.get_quote(db, symbol)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("/ticker")
def ticker(db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    return get_ticker(db)


@router.get("/quotes")
def quotes(
    symbols: str | None = Query(default=None, description="Comma-separated symbols"),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    sym_list = [s.strip() for s in symbols.split(",")] if symbols else None
    return get_ticker(db, sym_list)


@router.get("/status")
def status(user_id=Depends(get_current_user_id)):
    return market_status()


@router.post("/size")
def size(payload: SizeIn, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analysis_service.size_trade(db, _user(db, user_id), payload)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("/analyses", response_model=list[AnalysisOut])
def list_analyses(
    account_id: UUID | None = None,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    return analysis_service.list_analyses(db, user_id, account_id)


@router.post("/analyses", response_model=AnalysisOut)
def create_analysis(
    payload: AnalysisIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return analysis_service.create_analysis(db, _user(db, user_id), payload)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("/analyses/{analysis_id}", response_model=AnalysisOut)
def get_analysis(analysis_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return analysis_service._owned_analysis(db, user_id, analysis_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.patch("/analyses/{analysis_id}", response_model=AnalysisOut)
def patch_analysis(
    analysis_id: UUID,
    payload: AnalysisUpdate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return analysis_service.update_analysis(db, _user(db, user_id), analysis_id, payload)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/analyses/{analysis_id}/annotations", response_model=AnnotationOut)
def create_annotation(
    analysis_id: UUID,
    payload: AnnotationIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return analysis_service.add_annotation(db, _user(db, user_id), analysis_id, payload)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.patch("/annotations/{annotation_id}", response_model=AnnotationOut)
def patch_annotation(
    annotation_id: UUID,
    payload: AnnotationIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return analysis_service.update_annotation(db, _user(db, user_id), annotation_id, payload)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.delete("/annotations/{annotation_id}", status_code=204)
def remove_annotation(
    annotation_id: UUID,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        analysis_service.delete_annotation(db, _user(db, user_id), annotation_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/analyses/{analysis_id}/trade-plan")
def create_trade_plan(
    analysis_id: UUID,
    payload: TradePlanIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return analysis_service.trade_plan(db, _user(db, user_id), analysis_id, payload)
    except DomainError as exc:
        raise http_error(exc) from exc
