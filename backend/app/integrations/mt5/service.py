from __future__ import annotations

import logging
from datetime import timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import Mt5ConnectionStatus
from app.core.exceptions import ConflictError, DomainError, NotFoundError
from app.core.time import utcnow
from app.integrations.mt5.schemas import Mt5ConnectionCreatedOut, Mt5ConnectionOut
from app.integrations.mt5.token import generate_connector_token
from app.models.mt5_connection import Mt5Connection
from app.models.user import User
from app.services.access import get_owned_account

logger = logging.getLogger(__name__)


def _serialize(connection: Mt5Connection) -> Mt5ConnectionOut:
    status = _effective_status(connection)
    return Mt5ConnectionOut(
        id=connection.id,
        account_id=connection.account_id,
        status=status,
        token_prefix=connection.token_prefix,
        mt5_login=connection.mt5_login,
        mt5_server=connection.mt5_server,
        broker_name=connection.broker_name,
        last_seen_at=connection.last_seen_at,
        last_sync_at=connection.last_sync_at,
        created_at=connection.created_at,
        revoked_at=connection.revoked_at,
    )


def _effective_status(connection: Mt5Connection) -> str:
    if connection.status == Mt5ConnectionStatus.REVOKED.value or connection.revoked_at:
        return Mt5ConnectionStatus.REVOKED.value
    if connection.last_seen_at is None:
        return connection.status
    age = (utcnow() - connection.last_seen_at).total_seconds()
    if age > settings.mt5_stale_seconds:
        return Mt5ConnectionStatus.STALE.value
    if connection.status in {Mt5ConnectionStatus.PENDING.value, Mt5ConnectionStatus.DISCONNECTED.value}:
        return Mt5ConnectionStatus.CONNECTED.value if connection.last_seen_at else connection.status
    return Mt5ConnectionStatus.CONNECTED.value


def create_connection(db: Session, user: User, account_id: UUID) -> Mt5ConnectionCreatedOut:
    get_owned_account(db, user.id, account_id)
    existing = (
        db.query(Mt5Connection)
        .filter(Mt5Connection.account_id == account_id, Mt5Connection.user_id == user.id)
        .one_or_none()
    )
    if existing is not None and existing.revoked_at is None:
        raise ConflictError("MT5 connection already exists for this account. Revoke or regenerate first.")

    if existing is not None:
        db.delete(existing)
        db.flush()

    token, token_hash, prefix = generate_connector_token()
    connection = Mt5Connection(
        user_id=user.id,
        account_id=account_id,
        status=Mt5ConnectionStatus.PENDING.value,
        token_hash=token_hash,
        token_prefix=prefix,
    )
    db.add(connection)
    db.commit()
    db.refresh(connection)
    logger.info("MT5 connection created account_id=%s connection_id=%s", account_id, connection.id)
    base = _serialize(connection)
    return Mt5ConnectionCreatedOut(**base.model_dump(), connection_token=token)


def list_connections(db: Session, user_id: UUID) -> list[Mt5ConnectionOut]:
    rows = (
        db.query(Mt5Connection)
        .filter(Mt5Connection.user_id == user_id)
        .order_by(Mt5Connection.created_at.desc())
        .all()
    )
    return [_serialize(row) for row in rows]


def get_connection_for_account(db: Session, user_id: UUID, account_id: UUID) -> Mt5ConnectionOut | None:
    get_owned_account(db, user_id, account_id)
    row = (
        db.query(Mt5Connection)
        .filter(Mt5Connection.account_id == account_id, Mt5Connection.user_id == user_id)
        .one_or_none()
    )
    if row is None:
        return None
    return _serialize(row)


def regenerate_connection(db: Session, user: User, connection_id: UUID) -> Mt5ConnectionCreatedOut:
    row = (
        db.query(Mt5Connection)
        .filter(Mt5Connection.id == connection_id, Mt5Connection.user_id == user.id)
        .one_or_none()
    )
    if row is None:
        raise NotFoundError("MT5 connection not found")
    if row.revoked_at is not None:
        raise DomainError("Cannot regenerate a revoked connection. Create a new one.")

    token, token_hash, prefix = generate_connector_token()
    row.token_hash = token_hash
    row.token_prefix = prefix
    row.status = Mt5ConnectionStatus.PENDING.value
    row.last_seen_at = None
    row.last_sync_at = None
    db.commit()
    db.refresh(row)
    logger.info("MT5 connection regenerated connection_id=%s", connection_id)
    base = _serialize(row)
    return Mt5ConnectionCreatedOut(**base.model_dump(), connection_token=token)


def revoke_connection(db: Session, user: User, connection_id: UUID) -> Mt5ConnectionOut:
    row = (
        db.query(Mt5Connection)
        .filter(Mt5Connection.id == connection_id, Mt5Connection.user_id == user.id)
        .one_or_none()
    )
    if row is None:
        raise NotFoundError("MT5 connection not found")
    row.status = Mt5ConnectionStatus.REVOKED.value
    row.revoked_at = utcnow()
    db.commit()
    db.refresh(row)
    logger.info("MT5 connection revoked connection_id=%s", connection_id)
    return _serialize(row)
