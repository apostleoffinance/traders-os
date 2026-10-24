# TraderOS Direct MT5 Companion for Mac (Preview)

This is an experimental, read-only macOS connector for TraderOS. It is designed for users running MetaTrader 5 for macOS from MetaQuotes. That terminal uses a Wine-based compatibility environment. The connector uses the third-party `mt5-mac` Python package to access the terminal; it does not use MetaTrader's official Windows-only Python package directly.

## Important preview status

- This implementation has **not** been validated end-to-end against a real MT5 terminal, FundedNext, TenTrade, or the production TraderOS API.
- `mt5-mac` is third-party software, not an official MetaQuotes package. Review its source, release history, and permissions before using it. Start with a demo or read-only account.
- Use a read-only/investor password where the broker supports one. The connector itself only calls account/position/history reads and sends sync data to TraderOS; it does not place, modify, or close orders.
- Credentials are stored using Python Keyring, which uses the macOS Keychain backend when available.
- Do not enter a live-account password until you have reviewed and are comfortable with the connector and dependency.

## Requirements

- macOS with MetaTrader 5 installed using the official Mac installer: https://www.metatrader5.com/en/terminal/help/start_advanced/install_mac
- Python 3.9 or later
- A TraderOS MT5 connection token
- Internet access

## Run

1. Install and open MetaTrader 5 for Mac; sign in to your broker account and confirm the terminal is connected.
2. In TraderOS, create an MT5 connection and copy the token.
3. Download and extract the Mac companion package.
4. In Finder, right-click `install-and-run.command`, choose Open, and approve the macOS prompt if shown. Alternatively run it from Terminal: `bash install-and-run.command`.
5. Enter the MT5 login, exact server name, password (prefer investor/read-only), and TraderOS token in the app.
6. Leave MT5 and the companion running, and keep the Mac awake and online. Confirm the companion reports a successful sync and then check the TraderOS account status.

The script creates a local `.venv` directory for dependencies. It does not install a background service or automatically start at login in this preview.

## API

The companion posts account info, open positions, and recent deals (48-hour window) to `/api/integrations/mt5/sync` on the configured TraderOS API origin. Default: `https://traders-os.vercel.app`.

## Troubleshooting

- Open MT5 manually first and let it finish loading before starting the companion.
- If the connector cannot initialize, check the terminal, package compatibility, Python version, and the exact broker server name.
- If TraderOS rejects sync, check that the configured API origin routes `/api/integrations/mt5/sync` to the backend and regenerate the connection token if necessary.
