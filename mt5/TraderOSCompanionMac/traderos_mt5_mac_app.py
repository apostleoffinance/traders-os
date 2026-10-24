from __future__ import annotations

import json
import logging
import threading
import time
import tkinter as tk
from tkinter import messagebox, ttk
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import keyring
import mt5_mac as mt5

APP = "TraderOS MT5 Companion for Mac"
SERVICE = "TraderOS-MT5-Companion-Mac"
DEFAULT_API = "https://traders-os.vercel.app"
POLL_SECONDS = 10
HISTORY_HOURS = 48
ENTRY_MAP = {
    mt5.DEAL_ENTRY_IN: "IN",
    mt5.DEAL_ENTRY_OUT: "OUT",
    mt5.DEAL_ENTRY_INOUT: "INOUT",
    mt5.DEAL_ENTRY_OUT_BY: "OUT_BY",
}


def utc(epoch):
    return datetime.fromtimestamp(epoch, timezone.utc).isoformat().replace("+00:00", "Z")


def num(value):
    try:
        value = float(value)
        return value if value == value and abs(value) != float("inf") else 0.0
    except (TypeError, ValueError):
        return 0.0


def get_config():
    return {key: keyring.get_password(SERVICE, key)
            for key in ("login", "server", "mt5_password", "api", "token")}


def setup_dialog():
    root = tk.Tk()
    root.title("Connect TraderOS to MT5")
    root.resizable(False, False)
    frame = ttk.Frame(root, padding=18)
    frame.grid()
    ttk.Label(frame, text="Connect your MT5 account",
              font=("Helvetica", 14, "bold")).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 12))
    fields = [
        ("MT5 login number", "login", "", False),
        ("Exact MT5 server", "server", "", False),
        ("MT5 investor/read-only password", "mt5_password", "", True),
        ("TraderOS connection token", "token", "", True),
        ("TraderOS API URL", "api", DEFAULT_API, False),
    ]
    entries = {}
    for row, (label, key, default, secret) in enumerate(fields, 1):
        ttk.Label(frame, text=label).grid(row=row, column=0, sticky="w", pady=4, padx=(0, 12))
        entry = ttk.Entry(frame, width=42, show="*" if secret else "")
        entry.grid(row=row, column=1, sticky="ew", pady=4)
        entry.insert(0, default)
        entries[key] = entry
    ttk.Label(
        frame,
        text="Credentials are stored in macOS Keychain. Use an investor/read-only password where supported.",
        wraplength=460,
    ).grid(row=6, column=0, columnspan=2, sticky="w", pady=(10, 12))
    result = {"saved": False}

    def save():
        values = {key: entry.get().strip() for key, entry in entries.items()}
        if not values["login"].isdigit() or not values["server"] or not values["mt5_password"] or len(values["token"]) < 8:
            messagebox.showerror(APP, "Enter a numeric login, server, MT5 password and TraderOS token.", parent=root)
            return
        if not (values["api"].startswith("https://") or values["api"].startswith(("http://127.0.0.1", "http://localhost"))):
            messagebox.showerror(APP, "Use HTTPS for deployed TraderOS APIs.", parent=root)
            return
        try:
            for key, value in values.items():
                keyring.set_password(SERVICE, key, value)
        except Exception as exc:
            messagebox.showerror(APP, f"Could not save credentials securely: {exc}", parent=root)
            return
        result["saved"] = True
        root.destroy()

    ttk.Button(frame, text="Save and connect", command=save).grid(row=7, column=1, sticky="e")
    root.protocol("WM_DELETE_WINDOW", root.destroy)
    root.mainloop()
    return result["saved"]


def build_payload():
    account = mt5.account_info()
    if account is None:
        raise RuntimeError(f"MT5 account_info failed: {mt5.last_error()}")
    rows = mt5.positions_get()
    if rows is None:
        raise RuntimeError(f"MT5 positions_get failed: {mt5.last_error()}")
    positions = []
    for p in rows:
        positions.append({
            "external_position_id": str(getattr(p, "identifier", 0) or p.ticket),
            "symbol_raw": str(p.symbol),
            "direction": "LONG" if p.type == mt5.POSITION_TYPE_BUY else "SHORT",
            "volume": num(p.volume), "entry_price": num(p.price_open),
            "current_price": num(p.price_current), "stop_loss": num(p.sl) or None,
            "take_profit": num(p.tp) or None, "opened_at": utc(p.time),
            "unrealized_pnl": num(p.profit), "swap": num(p.swap), "commission": 0,
            "magic": int(getattr(p, "magic", 0)),
            "comment": str(getattr(p, "comment", "") or "")[:250],
        })
    now = datetime.now(timezone.utc)
    deals = mt5.history_deals_get(now - timedelta(hours=HISTORY_HOURS), now)
    if deals is None:
        raise RuntimeError(f"MT5 history_deals_get failed: {mt5.last_error()}")
    recent = []
    for d in deals:
        if d.type not in (mt5.DEAL_TYPE_BUY, mt5.DEAL_TYPE_SELL):
            continue
        entry = ENTRY_MAP.get(d.entry)
        position_id = getattr(d, "position_id", 0) or getattr(d, "position", 0)
        if not entry or not position_id:
            continue
        recent.append({
            "external_deal_id": str(d.ticket), "external_position_id": str(position_id),
            "symbol_raw": str(d.symbol),
            "direction": "LONG" if d.type == mt5.DEAL_TYPE_BUY else "SHORT",
            "entry_type": entry, "volume": num(d.volume), "price": num(d.price),
            "profit": num(d.profit), "commission": num(d.commission),
            "swap": num(d.swap), "deal_time": utc(d.time),
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
        "positions": positions, "recent_deals": recent, "bars": [],
    }


def send_sync(api, token, payload):
    request = Request(
        api.rstrip("/") + "/api/integrations/mt5/sync",
        data=json.dumps(payload, separators=(",", ":")).encode(),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "TraderOS-MT5-Companion-Mac/1.0",
        },
    )
    with urlopen(request, timeout=25) as response:
        body = response.read().decode("utf-8", errors="replace")
        return json.loads(body) if body else {"http_status": response.status}


class App:
    def __init__(self):
        self.stop = threading.Event()
        self.root = None
        self.status = None
        self.thread = None

    def set_status(self, value):
        logging.info(value)
        if self.root and self.status:
            self.root.after(0, lambda: self.status.set(value))

    def sync_loop(self):
        while not self.stop.is_set():
            config = get_config()
            if not all(config.values()):
                self.set_status("Setup required. Choose Change account / token.")
                self.stop.wait(POLL_SECONDS)
                continue
            try:
                if not mt5.initialize(login=int(config["login"]), password=config["mt5_password"], server=config["server"]):
                    raise RuntimeError(f"MT5 connection failed: {mt5.last_error()}")
                account = mt5.account_info()
                if account is None or int(account.login) != int(config["login"]):
                    raise RuntimeError("MT5 account verification failed; check login, server and password.")
                self.set_status(f"Connected to {account.login} ({account.server}). Syncing read-only data.")
                while not self.stop.is_set():
                    try:
                        payload = build_payload()
                        send_sync(config["api"], config["token"], payload)
                        self.set_status(f"Connected — last sync successful; {len(payload['positions'])} open positions.")
                    except HTTPError as exc:
                        self.set_status(f"TraderOS returned HTTP {exc.code}; check the connection token.")
                    except (URLError, TimeoutError, RuntimeError, ValueError, TypeError, OSError) as exc:
                        self.set_status(f"Sync paused: {exc}. Reconnecting…")
                        mt5.shutdown()
                        break
                    if self.stop.wait(POLL_SECONDS):
                        break
            except Exception as exc:
                self.set_status(f"Connection unavailable: {exc}. Retrying…")
            finally:
                mt5.shutdown()
            self.stop.wait(5)

    def open_setup(self):
        self.stop.set()
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=4)
        mt5.shutdown()
        if setup_dialog():
            self.stop.clear()
            self.thread = threading.Thread(target=self.sync_loop, daemon=True)
            self.thread.start()

    def run(self):
        if not all(get_config().values()) and not setup_dialog():
            return
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
        self.root = tk.Tk()
        self.root.title("TraderOS MT5 Companion for Mac")
        self.root.geometry("520x210")
        self.status = tk.StringVar(value="Starting connection…")
        frame = ttk.Frame(self.root, padding=18)
        frame.pack(fill="both", expand=True)
        ttk.Label(frame, text="TraderOS MT5 Companion", font=("Helvetica", 13, "bold")).pack(anchor="w")
        ttk.Label(frame, textvariable=self.status, wraplength=470).pack(anchor="w", pady=14)
        row = ttk.Frame(frame)
        row.pack(fill="x")
        ttk.Button(row, text="Change account / token", command=self.open_setup).pack(side="left")
        ttk.Button(row, text="Quit", command=self.close).pack(side="right")
        self.thread = threading.Thread(target=self.sync_loop, daemon=True)
        self.thread.start()
        self.root.protocol("WM_DELETE_WINDOW", self.root.iconify)
        self.root.mainloop()

    def close(self):
        self.stop.set()
        mt5.shutdown()
        if self.root:
            self.root.destroy()


if __name__ == "__main__":
    App().run()
