"""Repair historical MT5 trade timestamps recorded before the broker-offset fix.

Dry-run by default — prints the old → new timestamps for review. Pass --apply to commit.

    python -m app.jobs.backfill_mt5_broker_offset --account-id <uuid> [--apply]

Only touches trades with source=mt5 for the given account, shifting trade_timestamp
and exit_timestamp by the connection's currently-detected broker_utc_offset_seconds.
Run once per account after upgrading; a fresh sync must have already populated the
connection's offset (attach/reattach the recompiled EA and let one sync go through).
"""

from __future__ import annotations

import argparse
from datetime import timedelta
from uuid import UUID

from app.core.time import as_utc
from app.db.session import SessionLocal
from app.models.mt5_connection import Mt5Connection
from app.models.trade import Trade


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account-id", required=True, type=UUID)
    parser.add_argument("--apply", action="store_true", help="Commit changes (default: dry-run).")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        connection = db.query(Mt5Connection).filter(Mt5Connection.account_id == args.account_id).one_or_none()
        if connection is None:
            print(f"No MT5 connection found for account {args.account_id}.")
            return
        offset = connection.broker_utc_offset_seconds
        if not offset:
            print(
                "No broker offset detected on this connection yet. Reattach the recompiled EA, "
                "let a sync go through, then re-run this job."
            )
            return

        delta = timedelta(seconds=offset)
        trades = (
            db.query(Trade)
            .filter(Trade.account_id == args.account_id, Trade.external_provider == "mt5")
            .all()
        )
        print(f"Detected broker offset: {offset}s ({offset / 3600:+.2f}h). {len(trades)} MT5 trade(s) found.")
        for trade in trades:
            new_entry = as_utc(trade.trade_timestamp) - delta
            new_exit = as_utc(trade.exit_timestamp) - delta if trade.exit_timestamp is not None else None
            print(
                f"trade={trade.id} symbol={trade.symbol} "
                f"entry: {trade.trade_timestamp} -> {new_entry} "
                f"exit: {trade.exit_timestamp} -> {new_exit}"
            )
            if args.apply:
                trade.trade_timestamp = new_entry
                if trade.exit_timestamp is not None:
                    trade.exit_timestamp = new_exit

        if args.apply:
            db.commit()
            print(f"Applied correction to {len(trades)} trade(s).")
        else:
            print("Dry-run only — no changes committed. Re-run with --apply to commit.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
