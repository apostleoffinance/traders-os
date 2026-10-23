from __future__ import annotations

import argparse
import getpass
import json
import logging
import sys
import time
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import MetaTrader5 as mt5
except ImportError:
    print("Install dependencies with: pip install -r requirements.txt", file=sys.stderr)
    raise SystemExit(2)

POLL_SECONDS = 10
HISTORY_HOURS = 48
ENTRY_MAP = {
    mt5.DEAL_ENTRY_IN: "IN",
    mt5.DEAL_ENTRY_OUT: "OUT",
    mt5.DEAL_ENTRY_INOUT: "INOUT",
    mt5.DEAL_ENTRY_OUT_BY: "OUT_BY",
}


def iso_utc(epoch: int | float) -> str:
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat().replace("+00:00", "Z")


def num(value: object, default: float = 0.0) -> float:
    try:
        result = float(value)
        return result if result == result and abs(result) != float("inf") else default
    except (TypeError, ValueError):
        return default


def build_payload() -> dict:
    account = mt5.account_info()
    if account is None:
        raise RuntimeError(f"account_info failed: {mt5.last_error()}")

    positions = []
    rows = mt5.positions_get()
    if rows is None:
        raise RuntimeError(f"positions_get failed: {mt5.last_error()}")
    for p in rows:
        position_id = getattr(p, "identifier", 0) or p.ticket
        positions.append({
            "external_position_id": str(position_id),
            "symbol_raw": str(p.symbol),
            "direction": "LONG" if p.type == mt5.POSITION_TYPE_BUY else "SHORT",
            "volume": num(p.volume), "entry_price": num(p.price_open),
            "current_price": num(p.price_current),
            "stop_loss": num(p.sl) or None, "take_profit": num(p.tp) or None,
            "opened_at": iso_utc(p.time), "unrealized_pnl": num(p.profit),
            "swap": num(p.swap), "commission": 0,
            "magic": int(getattr(p, "magic", 0)),
            "comment": str(getattr(p, "comment", "") or "")[:250],
        })

    now = datetime.now(timezone.utc)
    deals = mt5.history_deals_get(now - timedelta(hours=HISTORY_HOURS), now)
    if deals is None:
        raise RuntimeError(f"history_deals_get failed: {mt5.last_error()}")
    recent_deals = []
    for d in deals:
        if d.type not in (mt5.DEAL_TYPE_BUY, mt5.DEAL_TYPE_SELL):
            continue
        entry = ENTRY_MAP.get(d.entry)
        position_id = getattr(d, "position_id", 0) or getattr(d, "position", 0)
        if entry is None or not position_id:
            continue
        recent_deals.append({
            "external_deal_id": str(d.ticket),
            "external_position_id": str(position_id),
            "symbol_raw": str(d.symbol),
            "direction": "LONG" if d.type == mt5.DEAL_TYPE_BUY else "SHORT",
            "entry_type": entry, "volume": num(d.volume), "price": num(d.price),
            "profit": num(d.profit), "commission": num(d.commission),
            "swap": num(d.swap), "deal_time": iso_utc(d.time),
        })

    return {
        "event_type": "sync", "platform": "MT5",
        "sync_timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "terminal_connected": True,
        "account": {
            "login": int(account.login), "server": str(account.server or ""),
            "company": str(account.company or ""), "currency": str(account.currency or ""),
            "balance": num(account.balance), "equity": num(account.equity),
        },
        "positions": positions, "recent_deals": recent_deals, "bars": [],
    }


def send_sync(api: str, token: str, payload: dict) -> dict:
    request = Request(
        api.rstrip("/") + "/api/integrations/mt5/sync",
        data=json.dumps(payload, separators=(",", ":")).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}",
                 "User-Agent": "TraderOS-MT5-Companion/0.1"},
    )
    with urlopen(request, timeout=25) as response:
        raw = response.read().decode("utf-8", errors="replace")
        return json.loads(raw) if raw else {"http_status": response.status}


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only MT5 to TraderOS connector")
    parser.add_argument("--api", default="https://traders-os.vercel.app", help="TraderOS API origin")
    parser.add_argument("--login", type=int, default=0, help="MT5 login number")
    parser.add_argument("--server", default="", help="Exact MT5 server name")
    parser.add_argument("--interval", type=int, default=POLL_SECONDS)
    args = parser.parse_args()
    api = args.api.strip().rstrip("/")
    if not (api.startswith("https://") or api.startswith("http://127.0.0.1") or api.startswith("http://localhost")):
        print("Use HTTPS for deployed APIs (HTTP is allowed only for localhost).", file=sys.stderr)
        return 2

    login = args.login or int(input("MT5 account login: ").strip())
    server = args.server.strip() or input("Exact MT5 server name: ").strip()
    password = getpass.getpass("MT5 investor/read-only password: ")
    token = getpass.getpass("TraderOS connection token (TOS-...): ").strip()
    if len(token) < 8:
        print("A valid TraderOS connection token is required.", file=sys.stderr)
        return 2

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not mt5.initialize(login=login, password=password, server=server):
        logging.error("MT5 initialize failed: %s", mt5.last_error())
        password = ""
        mt5.shutdown()
        return 1
    password = ""
    account = mt5.account_info()
    if account is None or int(account.login) != login:
        logging.error("MT5 did not authenticate to the requested account; check login/server credentials.")
        mt5.shutdown()
        return 1
    logging.info("Connected to MT5 account %s (%s); connector is read-only.", account.login, account.server)

    try:
        while True:
            try:
                payload = build_payload()
                result = send_sync(api, token, payload)
                logging.info("Sync OK: positions=%d deals=%d response=%s",
                             len(payload["positions"]), len(payload["recent_deals"]),
                             json.dumps(result, separators=(",", ":"))[:400])
            except HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")[:250]
                logging.error("TraderOS HTTP %s: %s", exc.code, detail)
                if exc.code in (401, 403):
                    logging.error("Check/regenerate the TraderOS connection token.")
            except (URLError, TimeoutError, RuntimeError, ValueError, TypeError, OSError) as exc:
                logging.error("Sync failed: %s", exc)
            time.sleep(max(5, args.interval))
    except KeyboardInterrupt:
        logging.info("Stopping companion.")
    finally:
        token = ""
        mt5.shutdown()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
