from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.models.account import Account
from app.models.trade import Trade


def get_owned_account(db: Session, user_id: UUID, account_id: UUID) -> Account:
    account = (
        db.query(Account)
        .filter(Account.id == account_id, Account.user_id == user_id)
        .one_or_none()
    )
    if account is None:
        raise NotFoundError("Account not found")
    return account


def get_owned_trade(db: Session, user_id: UUID, trade_id: UUID) -> Trade:
    trade = (
        db.query(Trade).filter(Trade.id == trade_id, Trade.user_id == user_id).one_or_none()
    )
    if trade is None:
        raise NotFoundError("Trade not found")
    return trade
