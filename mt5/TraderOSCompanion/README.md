# TraderOS Direct MT5 Companion (Windows)

A small, read-only Windows companion that connects to the MetaTrader 5 terminal through MetaQuotes' official `MetaTrader5` Python package and sends account/position/deal snapshots to TraderOS. It reuses TraderOS's existing `/api/integrations/mt5/sync` endpoint and connection token. It does **not** use Myfxbook, an EA, chart attachment, WebRequest allowlisting, or Algo Trading.

## Requirements

- Windows 10/11 (the official MetaTrader5 Python package requires a compatible local MT5 terminal installation).
- MetaTrader 5 desktop terminal installed. The companion can initialize the terminal with your account login, investor password, and exact broker server name; the terminal remains running while sync is active.
- A TraderOS account and trading account, with a connection token created from **Connect MT5** in TraderOS.
- Python 3.10–3.12, recommended 64-bit, and internet access.

## Setup

1. Install MT5 from the official broker website and confirm the FundedNext or TenTrade account is accessible in the terminal. Use the exact server name shown by the broker. If the broker only supplies a web terminal or does not expose an MT5 desktop login, this connector cannot connect to that account.
2. Download/clone this folder on the Windows computer that will remain on during syncing.
3. Open PowerShell in this folder and create an isolated environment:

   ```powershell
   py -3.12 -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. In TraderOS, open the correct account and choose **Connect MT5**. Copy the `TOS-...` connection token. Treat it like a password; it is not your broker password.
5. Run the companion:

   ```powershell
   python traderos_mt5_companion.py --api https://www.traders-os.vercel.app
   ```

   Replace the API origin with the actual deployed TraderOS API origin if it differs from the web app origin. The API origin must serve `/api/integrations/mt5/sync`.
6. Enter the MT5 login, exact server name, and **investor/read-only password** when prompted. Enter the TraderOS connection token when prompted. Passwords/tokens are not written to disk or printed to logs.
7. Keep the computer awake, the terminal open, and the companion process running. Stop with `Ctrl+C`.

You can optionally pass `--login` and `--server` to avoid prompting for those non-secret values. Do not pass passwords or tokens on the command line because they may be visible in process listings.

## What syncs

- MT5 account login, server, broker/company, currency, balance and equity.
- Current open positions, including volume, direction, entry/current prices, SL/TP, floating P/L and swap.
- Recent MT5 deals (last 48 hours), including entry/exit type, price, volume, profit, commission and swap. TraderOS performs deduplication/reconciliation server-side.

Trade journal enrichment (strategy, emotions, screenshots, notes, tags) remains editable in TraderOS after the automatic trade import. The connector is strictly read-only and never sends trade execution requests.

## Security and operational notes

- Prefer an investor/read-only password. Do not share it with anyone or save it in `.env`.
- The companion stores no broker password or TraderOS token on disk. The token is held in process memory until exit; revoke/regenerate it in TraderOS if exposed.
- Use HTTPS for a deployed TraderOS endpoint.
- This can have $0/month additional infrastructure cost when run on an existing computer, but that computer must stay online. Windows MT5 hosting or a VPS is not included.
- Broker/server compatibility must be verified with a demo or read-only test account before relying on live account history. FundedNext and TenTrade use MT5 accounts, but their exact server names and account access policies vary.
- The Python package talks to a local MT5 terminal; it is not a cloud REST API. If your broker's server cannot be reached from the installed terminal, the companion cannot bypass that restriction.

## Troubleshooting

- **Initialize failed / terminal not found:** install or open the official MT5 desktop terminal, confirm its bitness and Python bitness match, and retry.
- **Invalid account / authorization:** confirm the login, exact server name, and investor password with the broker. Never paste credentials into a support ticket.
- **HTTP 401/403:** check the TraderOS connection token; regenerate it if necessary.
- **HTTP 404:** verify the API origin and that it exposes `/api/integrations/mt5/sync`.
- **No deals imported:** check MT5's Account History and allow the connector to poll. Recent deals are fetched on each poll and duplicate IDs are reconciled by TraderOS.

## Data flow

```text
Windows computer
  └─ MetaTrader 5 desktop terminal
       └─ Official MetaTrader5 Python package (read-only polling)
            └─ HTTPS POST /api/integrations/mt5/sync
                 └─ TraderOS existing auth, deduplication and journal reconciliation
```
