# TraderOS Direct MT5 Companion for Windows

Read-only connector between a local MetaTrader 5 desktop terminal and TraderOS. It uses MetaQuotes' official Python package and TraderOS' authenticated `/api/integrations/mt5/sync` endpoint. It does **not** use Myfxbook, an Expert Advisor, chart attachment, WebRequest allowlisting, or Algo Trading.

## Customer installation

The Windows installer is built by the GitHub Actions workflow **TraderOS MT5 Companion Windows Build**. Open the workflow run for this branch and download its `TraderOS-MT5-Companion-Windows-Installer` artifact once the run succeeds. The installer is not yet a signed public release; Windows SmartScreen may show an unsigned-app warning until a code-signing certificate is configured.

1. Install the official MT5 desktop terminal from the broker and confirm the FundedNext or TenTrade account can log in there.
2. Run `TraderOS-MT5-Companion-Setup.exe`. Automatic startup at Windows sign-in is selected by default.
3. In TraderOS, open the account you want to connect and create a connection from **Connect MT5**. Copy its `TOS-...` token.
4. When the companion opens, enter the MT5 login, exact server name, investor/read-only password (if supported), and TraderOS connection token. The app stores these in Windows Credential Manager, not in a plaintext configuration file.
5. Leave the computer awake and connected to the internet. The companion shows its connection/sync status and retries after connection interruptions.

The app starts when the Windows user signs in. It does not run while the computer is shut down or asleep. MT5 desktop account access is required; a web-only account cannot be connected through this method. The user can turn off auto-start in Windows Startup Apps or uninstall the companion from Windows Settings.

## Build locally

Requirements: Windows 10/11, Python 3.12 x64, and Inno Setup 6. From PowerShell:

```powershell
.\build-windows.ps1
```

The installer is written to `dist\TraderOS-MT5-Companion-Setup.exe`. GitHub Actions builds the same artifact on changes to this folder or by manual workflow dispatch.

## Security and limitations

- The companion is read-only: it never submits, modifies, or closes trades.
- Secrets are stored through the operating system credential vault using Python keyring. Use an investor/read-only password where your broker supports it. Revoke the TraderOS connection token in TraderOS if exposed.
- This can have $0/month additional hosting cost when run on an existing Windows computer. A VPS or hosted Windows machine is not included.
- Exact FundedNext/TenTrade server and account compatibility must be validated using each broker's demo or read-only account before relying on it for live journaling. No live broker end-to-end test has been performed in this development environment.
- The sync API origin must serve `/api/integrations/mt5/sync`. The default is `https://traders-os.vercel.app`; if that deployment does not proxy the backend endpoint, set the correct API origin in the companion configuration.

## Data synchronized

Account login/server/company/currency/balance/equity, open positions, and recent deals (48-hour window). TraderOS reconciles/deduplicates the incoming data. Strategy, emotions, notes, tags, and screenshots remain journal fields managed in TraderOS.
