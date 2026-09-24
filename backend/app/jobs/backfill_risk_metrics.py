"""One-off repair: python -m app.jobs.backfill_risk_metrics

Recomputes risk/R fields for existing MT5-synced trades that were persisted with
risk_amount=0 because the quote-to-account conversion rate was unavailable at sync
time (affects non-USD-quoted pairs such as USDJPY; USD-quoted pairs like EURUSD
never hit this path).
"""

from __future__ import annotations

from decimal import Decimal

from app.db.session import SessionLocal
from app.models.account import Account
from app.models.trade import Trade
from app.services.risk_metrics_backfill import backfill_risk_metrics_for_trade


def main() -> None:
    db = SessionLocal()
    fixed = 0
    checked = 0
    try:
        candidates = (
            db.query(Trade)
            .filter(Trade.external_provider == "mt5", Trade.risk_amount.in_([None, Decimal("0")]))
            .all()
        )
        accounts: dict = {}
        for trade in candidates:
            checked += 1
            account = accounts.get(trade.account_id)
            if account is None:
                account = db.query(Account).filter(Account.id == trade.account_id).one_or_none()
                accounts[trade.account_id] = account
            if account is None:
                continue
            if backfill_risk_metrics_for_trade(db, trade, account):
                fixed += 1
        db.commit()
    finally:
        db.close()
    print(f"checked={checked} fixed={fixed}")


if __name__ == "__main__":
    main()
