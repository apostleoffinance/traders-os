from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.exceptions import AIUnavailable, DomainError, NotFoundError, http_error
from app.core.security import get_current_user_id, get_db
from app.models.user import User
from app.schemas.calculator import CalculatorCalculateIn, CalculatorExplainIn, CalculatorParseIn
from app.services import auth_service, calculator_ai, calculator_service

router = APIRouter(prefix="/calculator", tags=["calculator"])


def _user(db: Session, user_id: UUID) -> User:
    return auth_service.get_user(db, user_id)


@router.get("/instruments")
def instruments(user_id=Depends(get_current_user_id)):
    return {"instruments": calculator_service.list_calculator_instruments()}


@router.get("/instruments/{symbol}")
def instrument(symbol: str, user_id=Depends(get_current_user_id)):
    try:
        return calculator_service.get_calculator_instrument(symbol)
    except (DomainError, NotFoundError) as exc:
        raise http_error(exc) from exc


@router.get("/account-context")
def account_ctx(
    account_id: UUID = Query(...),
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return calculator_service.account_context(db, _user(db, user_id), account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/calculate")
def calculate(
    payload: CalculatorCalculateIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return calculator_service.run_calculate(db, _user(db, user_id), payload)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/parse")
def parse(
    payload: CalculatorParseIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return calculator_ai.parse_natural_language(db, _user(db, user_id), payload.account_id, payload.text)
    except (DomainError, AIUnavailable) as exc:
        raise http_error(exc) from exc


@router.post("/explain")
def explain(
    payload: CalculatorExplainIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return calculator_ai.explain_calculation(
            db, _user(db, user_id), payload.account_id, payload.calculation, payload.policy
        )
    except (DomainError, AIUnavailable) as exc:
        raise http_error(exc) from exc
