from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.exceptions import DomainError, http_error
from app.core.security import get_current_user_id, get_db
from app.integrations.mt5.auth import get_mt5_connection
from app.integrations.mt5.schemas import (
    Mt5ConnectionCreateIn,
    Mt5ConnectionCreatedOut,
    Mt5ConnectionOut,
    Mt5SyncIn,
    Mt5SyncOut,
)
from app.integrations.mt5.service import (
    create_connection,
    get_connection_for_account,
    list_connections,
    regenerate_connection,
    revoke_connection,
)
from app.integrations.mt5.sync_service import apply_sync
from app.models.mt5_connection import Mt5Connection
from app.services.auth_service import get_user

router = APIRouter(prefix="/integrations/mt5", tags=["mt5"])


def _user(db: Session, user_id: UUID):
    return get_user(db, user_id)


@router.post("/connections", response_model=Mt5ConnectionCreatedOut, status_code=201)
def create_mt5_connection(
    payload: Mt5ConnectionCreateIn,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    try:
        return create_connection(db, _user(db, user_id), payload.account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.get("/connections", response_model=list[Mt5ConnectionOut])
def list_mt5_connections(
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return list_connections(db, user_id)


@router.get("/connections/by-account/{account_id}", response_model=Mt5ConnectionOut | None)
def get_mt5_connection_for_account(
    account_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    try:
        return get_connection_for_account(db, user_id, account_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/connections/{connection_id}/regenerate", response_model=Mt5ConnectionCreatedOut)
def regenerate_mt5_connection(
    connection_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    try:
        return regenerate_connection(db, _user(db, user_id), connection_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/connections/{connection_id}/revoke", response_model=Mt5ConnectionOut)
def revoke_mt5_connection(
    connection_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    try:
        return revoke_connection(db, _user(db, user_id), connection_id)
    except DomainError as exc:
        raise http_error(exc) from exc


@router.post("/sync", response_model=Mt5SyncOut)
def mt5_sync(
    payload: Mt5SyncIn,
    db: Session = Depends(get_db),
    connection: Mt5Connection = Depends(get_mt5_connection),
):
    try:
        return apply_sync(db, connection, payload)
    except DomainError as exc:
        raise http_error(exc) from exc
