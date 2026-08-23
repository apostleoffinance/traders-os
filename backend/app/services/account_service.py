from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.core.enums import AccountStatus, EnforcementMode
from app.core.exceptions import NotFoundError
from app.models.account import Account, AccountRiskProfile
from app.models.user import User
from app.schemas.account import AccountCreate, AccountUpdate, RiskProfileIn
from app.services.defaults import ACCOUNT_TEMPLATES, DEFAULT_PREFERRED_WINDOWS


def _profile_from_payload(account_id: UUID, payload: RiskProfileIn) -> AccountRiskProfile:
    data = payload.model_dump()
    windows = [w if isinstance(w, dict) else w.model_dump() for w in payload.preferred_windows]
    if not windows:
        windows = list(DEFAULT_PREFERRED_WINDOWS)
    data["preferred_windows"] = windows
    data["risk_per_trade_enforcement"] = payload.risk_per_trade_enforcement.value
    data["hard_risk_enforcement"] = payload.hard_risk_enforcement.value
    data["drawdown_basis"] = payload.drawdown_basis.value
    return AccountRiskProfile(account_id=account_id, **data)


def _template_profile(account_id: UUID, template_key: str) -> AccountRiskProfile:
    tmpl = ACCOUNT_TEMPLATES[template_key]
    rp = tmpl["risk_profile"]
    return AccountRiskProfile(
        account_id=account_id,
        risk_per_trade=rp["risk_per_trade"],
        personal_daily_loss_limit=rp["personal_daily_loss_limit"],
        personal_max_drawdown=rp["personal_max_drawdown"],
        firm_daily_drawdown_limit=rp["firm_daily_drawdown_limit"],
        firm_max_drawdown_limit=rp["firm_max_drawdown_limit"],
        max_trades_per_day=rp["max_trades_per_day"],
        preferred_min_rr=rp["preferred_min_rr"],
        preferred_rr=rp["preferred_rr"],
        minimum_trading_days=rp["minimum_trading_days"],
        hard_risk_per_trade=rp.get("hard_risk_per_trade"),
        preferred_windows=rp.get("preferred_windows") or list(DEFAULT_PREFERRED_WINDOWS),
        notes=rp.get("notes"),
        risk_per_trade_enforcement=EnforcementMode.CONFIRM.value,
        hard_risk_enforcement=EnforcementMode.BLOCK.value,
    )


def list_accounts(db: Session, user_id: UUID) -> list[Account]:
    return (
        db.query(Account)
        .options(joinedload(Account.risk_profile))
        .filter(Account.user_id == user_id)
        .order_by(Account.created_at.desc())
        .all()
    )


def get_account(db: Session, user_id: UUID, account_id: UUID) -> Account:
    account = (
        db.query(Account)
        .options(joinedload(Account.risk_profile))
        .filter(Account.id == account_id, Account.user_id == user_id)
        .one_or_none()
    )
    if account is None:
        raise NotFoundError("Account not found")
    return account


def create_account(db: Session, user: User, payload: AccountCreate) -> Account:
    template = ACCOUNT_TEMPLATES.get(payload.template or "")
    firm = payload.firm
    program = payload.program
    name = payload.account_name
    currency = payload.currency
    starting = payload.starting_balance
    if template and payload.template:
        firm = firm or template["firm"]
        program = program or template["program"]
        name = name or template["account_name"]
        currency = currency or template["currency"]
        if payload.starting_balance is None:
            starting = template["starting_balance"]

    account = Account(
        user_id=user.id,
        firm=firm,
        program=program,
        account_name=name,
        currency=currency,
        starting_balance=starting,
        current_balance=starting,
        current_equity=starting,
        status=AccountStatus.ACTIVE.value,
    )
    db.add(account)
    db.flush()

    if payload.risk_profile:
        profile = _profile_from_payload(account.id, payload.risk_profile)
    elif payload.template and payload.template in ACCOUNT_TEMPLATES:
        profile = _template_profile(account.id, payload.template)
        # If user overrode starting balance, keep their number; risk $ amounts stay from template
        # unless they also sent a custom profile.
    else:
        # Conservative blank profile: 0.5% risk, 1% daily, 5% personal DD
        profile = AccountRiskProfile(
            account_id=account.id,
            risk_per_trade=Decimal(starting) * Decimal("0.005"),
            personal_daily_loss_limit=Decimal(starting) * Decimal("0.01"),
            personal_max_drawdown=Decimal(starting) * Decimal("0.05"),
            firm_daily_drawdown_limit=Decimal(starting) * Decimal("0.06"),
            firm_max_drawdown_limit=Decimal(starting) * Decimal("0.09"),
            max_trades_per_day=2,
            preferred_min_rr=Decimal("1.50"),
            preferred_rr=Decimal("2.00"),
            minimum_trading_days=5,
            preferred_windows=list(DEFAULT_PREFERRED_WINDOWS),
        )
    db.add(profile)
    db.commit()
    return get_account(db, user.id, account.id)


def update_account(db: Session, user_id: UUID, account_id: UUID, payload: AccountUpdate) -> Account:
    account = get_account(db, user_id, account_id)
    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        data["status"] = data["status"].value if hasattr(data["status"], "value") else data["status"]
    for key, value in data.items():
        setattr(account, key, value)
    db.commit()
    return get_account(db, user_id, account_id)


def update_risk_profile(
    db: Session, user_id: UUID, account_id: UUID, payload: RiskProfileIn
) -> AccountRiskProfile:
    account = get_account(db, user_id, account_id)
    existing = account.risk_profile
    data = payload.model_dump()
    data["preferred_windows"] = [w.model_dump() for w in payload.preferred_windows] or list(
        DEFAULT_PREFERRED_WINDOWS
    )
    data["risk_per_trade_enforcement"] = payload.risk_per_trade_enforcement.value
    data["hard_risk_enforcement"] = payload.hard_risk_enforcement.value
    data["drawdown_basis"] = payload.drawdown_basis.value
    if existing is None:
        profile = AccountRiskProfile(account_id=account.id, **data)
        db.add(profile)
    else:
        for key, value in data.items():
            setattr(existing, key, value)
        profile = existing
    db.commit()
    db.refresh(profile)
    return profile


def refresh_account_balances(db: Session, account: Account) -> None:
    from sqlalchemy import func

    from app.models.trade import Trade

    closed_pnl = (
        db.query(func.coalesce(func.sum(Trade.realized_pnl), 0))
        .filter(
            Trade.account_id == account.id,
            Trade.user_id == account.user_id,
            Trade.status == "closed",
        )
        .scalar()
    )
    equity = Decimal(account.starting_balance) + Decimal(closed_pnl)
    account.current_balance = equity
    account.current_equity = equity
    db.add(account)
