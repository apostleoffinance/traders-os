"""Create the initial TenTrade account for an existing user.

Usage (from backend/):
    python -m app.seed --email you@example.com
"""

from __future__ import annotations

import argparse

from app.db.session import SessionLocal
from app.models.user import User
from app.schemas.account import AccountCreate
from app.services.account_service import create_account, list_accounts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == args.email.lower()).one_or_none()
        if user is None:
            raise SystemExit(f"No user with email {args.email}. Register in the app first.")
        existing = list_accounts(db, user.id)
        if any(a.firm == "TenTrade" for a in existing):
            print("TenTrade account already exists.")
            return
        account = create_account(
            db,
            user,
            AccountCreate(
                firm="TenTrade",
                program="TenEdge Instant",
                account_name="TenTrade TenEdge Instant $1K",
                currency="USD",
                starting_balance=1000,
                template="tentrade_tenedge_1k",
            ),
        )
        print(f"Created account {account.id} ({account.account_name})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
