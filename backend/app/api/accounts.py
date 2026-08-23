from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, http_error
from app.core.security import get_current_user_id, get_db
from app.schemas.account import AccountCreate, AccountOut, AccountUpdate, RiskProfileIn, RiskProfileOut
from app.services import account_service, auth_service

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _user(db: Session, user_id: UUID):
    return auth_service.get_user(db, user_id)


@router.get("", response_model=list[AccountOut])
def list_accounts(db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    return account_service.list_accounts(db, user_id)


@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return account_service.create_account(db, _user(db, user_id), payload)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("/{account_id}", response_model=AccountOut)
def get_account(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        return account_service.get_account(db, user_id, account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.patch("/{account_id}", response_model=AccountOut)
def update_account(
    account_id: UUID,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return account_service.update_account(db, user_id, account_id, payload)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("/{account_id}/risk-profile", response_model=RiskProfileOut)
def get_risk_profile(account_id: UUID, db: Session = Depends(get_db), user_id=Depends(get_current_user_id)):
    try:
        account = account_service.get_account(db, user_id, account_id)
        return account.risk_profile
    except DomainError as exc:
        raise http_error(exc) from exc


@router.put("/{account_id}/risk-profile", response_model=RiskProfileOut)
def put_risk_profile(
    account_id: UUID,
    payload: RiskProfileIn,
    db: Session = Depends(get_db),
    user_id=Depends(get_current_user_id),
):
    try:
        return account_service.update_risk_profile(db, user_id, account_id, payload)
    except DomainError as exc:
        raise http_error(exc) from exc
