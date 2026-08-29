# Trader OS Sync EA (MT5)

Read-only MetaTrader 5 Expert Advisor that syncs your trading activity into **Trader OS**. The EA observes positions and deals inside your already-logged-in MT5 terminal and sends snapshots to the Trader OS API.

## What it can do

- Authenticate with a Trader OS **connection token** (not your password)
- Send heartbeats / sync snapshots on a timer
- Detect trade activity via `OnTradeTransaction` and queue a sync
- Sync open positions (entry, SL, TP, volume, unrealized P/L)
- Sync recent closing deals (exit price, realized P/L, commission, swap)

## What it cannot do

- Place, modify, or close trades
- Access your MT5 password (you trade manually as usual)
- Move funds or change account settings

There are **no** calls to `OrderSend`, `CTrade`, `PositionClose`, `PositionModify`, or similar execution APIs.

## Installation

1. In Trader OS, open your account → **Connect MT5** → **Download TraderOSSync.zip**
2. Unzip and copy the `TraderOSSync` folder into your MT5 data directory:
   - **File → Open Data Folder → MQL5 → Experts**
3. In MT5 **Navigator → Expert Advisors**, refresh and attach **TraderOSSync** to any chart.
4. Set EA inputs (copy values from the Connect MT5 wizard in Trader OS):
   - **ApiBaseUrl** — your Trader OS URL (production uses the same URL as the web app)
   - **ConnectionToken** — your `TOS-…` connection code
   - **SyncIntervalSeconds** — default `10`
5. **Tools → Options → Expert Advisors** → allow WebRequest for your **ApiBaseUrl** (no path).
6. Enable **Allow Algo Trading** on the chart.

**Developers:** compile from source with MetaEditor (F7) if you change `TraderOSSync.mq5`. Run `npm run package:mt5` in `frontend/` to refresh the downloadable zip before deploy.

## WebRequest URL allowlist

MT5 blocks HTTP unless the URL is explicitly allowed:

1. **Tools → Options → Expert Advisors**
2. Check **Allow WebRequest for listed URL**
3. Add your API origin **without** a path, e.g.:
   - `http://127.0.0.1:8000`
   - `https://your-api.onrender.com`
4. Restart MT5 or reattach the EA.

## Local end-to-end test

1. Start Postgres and run migrations: `cd backend && alembic upgrade head`
2. Start API: `cd backend && uvicorn app.main:app --reload --port 8000`
3. Start frontend: `cd frontend && npm run dev`
4. Register / log in, create a Trader OS account.
5. On the account page, **Connect MT5** and copy the token.
6. Open an MT5 **demo** account, compile and attach the EA with the token.
7. Open a manual **EURUSD** trade in MT5.
8. Within ~10 seconds, the trade should appear in Trader OS **Trades** with source **MT5**.

## EA test checklist

| Test | Action | Expected |
|------|--------|----------|
| 1 | Attach EA | Experts tab shows sync OK / HTTP 200 |
| 2 | Open EURUSD manually | Trader OS creates **OPEN** trade |
| 3 | Modify SL | Same trade updates SL |
| 4 | Close trade | Trade becomes **CLOSED** with exit & P/L |
| 5 | Restart EA | No duplicate trades |
| 6 | Stop backend | EA logs error, retries next interval |
| 7 | Restart backend | Next sync reconciles state |

## Architecture

```text
MT5 terminal (manual trading)
        │
        ▼
TraderOSSync EA (observe → JSON snapshot)
        │
        ▼ HTTPS POST /api/integrations/mt5/sync
Trader OS FastAPI (auth → normalize → reconcile → journal)
```

Business logic (deduplication, symbol mapping, journal rules) lives on the **server**, not in the EA.

## Known V0.1 limitations

- One MT5 connection per Trader OS account
- Partial closes: volume updates on the same journal trade when possible; complex ticket splits may need a future release
- Unknown broker symbols are stored as **unresolved** until mapped to the Trader OS catalog
- `localhost` WebRequest works on most desktop MT5 builds; use a tunnel if your environment blocks it

## Security

- Store the connection token like a password. Regenerate it in Trader OS if compromised.
- Never commit your token to git or share screenshots of EA inputs.
