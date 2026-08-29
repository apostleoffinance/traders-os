from __future__ import annotations

import logging
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.enums import Mt5ConnectionStatus
from app.core.security import get_db
from app.integrations.mt5.token import hash_token
from app.models.mt5_connection import Mt5Connection

logger = logging.getLogger(__name__)

connector_bearer = HTTPBearer(auto_error=False)


def get_mt5_connection(
    credentials: HTTPAuthorizationCredentials | None = Depends(connector_bearer),
    db: Session = Depends(get_db),
) -> Mt5Connection:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_connector", "message": "Connector token required."},
        )
    token_hash = hash_token(credentials.credentials)
    connection = (
        db.query(Mt5Connection)
        .filter(Mt5Connection.token_hash == token_hash)
        .one_or_none()
    )
    if connection is None:
        logger.warning("MT5 connector auth failed: unknown token prefix")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "invalid_connector", "message": "Invalid connector token."},
        )
    if connection.status == Mt5ConnectionStatus.REVOKED.value or connection.revoked_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "connector_revoked", "message": "Connection has been revoked."},
        )
    return connection
