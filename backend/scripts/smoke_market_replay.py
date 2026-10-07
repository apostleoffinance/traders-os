"""Live market replay smoke test against configured FX/crypto providers and the real DB.

Run from backend/:
    python scripts/smoke_market_replay.py
    python scripts/smoke_market_replay.py --timeframe M15 --hours 12

This writes genuine provider candles to the canonical market_candles table.
Use --start/--end for a reproducible interval; both must include a timezone.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any


from app.core.time import as_utc
from app.db.session import SessionLocal
from app.market_data.replay_window import ReplayWindowIn, build_replay_window
from app.models.market import MarketCandle


TIMEFRAME_MINUTES = {"M1": 1, "M5": 5, "M15": 15, "M30": 30, "H1": 60, "H4": 240, "D1": 1440}


def parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise argparse.ArgumentTypeError(
            "timestamps must include a timezone, e.g. 2026-10-06T08:00:00Z"
        )
    return parsed.astimezone(timezone.utc)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fx", default="EURUSD", help="FX symbol (default: EURUSD)")
    parser.add_argument("--crypto", default="BTCUSDT", help="Crypto symbol (default: BTCUSDT)")
    parser.add_argument("--timeframe", default="M5", choices=sorted(TIMEFRAME_MINUTES))
    parser.add_argument(
        "--hours", type=float, default=4,
        help="Lookback hours if no explicit interval is supplied",
    )
    parser.add_argument("--start", type=parse_datetime, help="Timezone-aware UTC start")
    parser.add_argument("--end", type=parse_datetime, help="Timezone-aware UTC end")
    parser.add_argument("--limit", type=int, default=500)
    args = parser.parse_args()
    if (args.start is None) != (args.end is None):
        parser.error("--start and --end must be supplied together")
    if args.start is not None and args.end <= args.start:
        parser.error("--end must be later than --start")
    if args.hours <= 0:
        parser.error("--hours must be positive")
    if not 10 <= args.limit <= 1000:
        parser.error("--limit must be between 10 and 1000")
    return args


def main() -> int:
    args = arguments()
    if args.start is None:
        now = datetime.now(timezone.utc)
        interval = TIMEFRAME_MINUTES[args.timeframe]
        rounded_minute = (now.minute // interval) * interval
        end = now.replace(minute=rounded_minute, second=0, microsecond=0)
        start = end - timedelta(hours=args.hours)
    else:
        start, end = args.start, args.end

    request = ReplayWindowIn(
        symbols=[args.fx, args.crypto],
        timeframe=args.timeframe,
        start=start,
        end=end,
        limit=args.limit,
    )
    db = SessionLocal()
    try:
        result = build_replay_window(db, request)
        verification: list[dict[str, Any]] = []
        for series in result["series"]:
            first = datetime.fromisoformat(series["first_timestamp"].replace("Z", "+00:00"))
            last = datetime.fromisoformat(series["last_timestamp"].replace("Z", "+00:00"))
            stored_rows = (
                db.query(MarketCandle)
                .filter(
                    MarketCandle.provider == series["provider"],
                    MarketCandle.symbol == series["symbol"],
                    MarketCandle.timeframe == result["timeframe"],
                    MarketCandle.timestamp >= as_utc(first),
                    MarketCandle.timestamp <= as_utc(last),
                )
                .all()
            )
            stored_by_timestamp = {
                as_utc(row.timestamp).isoformat(): row for row in stored_rows
            }
            mismatches: list[str] = []
            for expected in series["candles"]:
                expected_timestamp = datetime.fromisoformat(
                    expected["timestamp"].replace("Z", "+00:00")
                ).astimezone(timezone.utc).isoformat()
                actual = stored_by_timestamp.get(expected_timestamp)
                if actual is None:
                    mismatches.append(f"missing candle at {expected['timestamp']}")
                    continue
                for field in ("open", "high", "low", "close", "volume"):
                    expected_value = expected[field]
                    actual_value = getattr(actual, field)
                    if expected_value is None:
                        matches = actual_value is None
                    else:
                        matches = (
                            actual_value is not None
                            and Decimal(str(actual_value)) == Decimal(expected_value)
                        )
                    if not matches:
                        mismatches.append(
                            f"{field} mismatch at {expected['timestamp']}"
                        )
            if mismatches:
                raise RuntimeError(
                    f"Persistence verification failed for {series['symbol']}: "
                    + "; ".join(mismatches[:10])
                )
            verification.append({
                "symbol": series["symbol"],
                "asset_class": series["asset_class"],
                "provider": series["provider"],
                "candles_returned": series["count"],
                "candles_exactly_verified": len(series["candles"]),
                "first_timestamp": series["first_timestamp"],
                "last_timestamp": series["last_timestamp"],
            })

        expected_timeline_count = sum(series["count"] for series in result["series"])
        timeline_keys = [
            (row["timestamp"], row["symbol"]) for row in result["timeline"]
        ]
        if timeline_keys != sorted(timeline_keys):
            raise RuntimeError("Replay timeline is not ordered by timestamp and symbol")
        if result["timeline_count"] != expected_timeline_count:
            raise RuntimeError("Replay timeline count does not match returned candle counts")
        if len(result["series"]) != 2 or any(not series["count"] for series in result["series"]):
            raise RuntimeError("Expected non-empty FX and crypto replay series")

        report = {
            "result": "PASS",
            "provider_fetch": "PASS",
            "database_persistence": "PASS",
            "shared_window_replay": "PASS",
            "wrun_integration": "NOT_TESTED",
            "window": result["window"],
            "timeframe": result["timeframe"],
            "timeline_events": result["timeline_count"],
            "series": verification,
            "caveats": result["caveats"],
            "wrun_note": (
                "This tests TraderOS's existing provider adapters, not Wrun. "
                "Wrun remains unapproved until its supported external API/SDK "
                "and FX coverage are verified."
            ),
        }
        print(json.dumps(report, indent=2))
        return 0
    except Exception as exc:
        db.rollback()
        print(json.dumps({
            "result": "FAIL",
            "error_type": type(exc).__name__,
            "error": str(exc),
            "wrun_integration": "NOT_TESTED",
        }, indent=2), file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
