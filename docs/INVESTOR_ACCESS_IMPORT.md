# Investor-access import (FundedNext + TenTrade)

## Proposed zero-license-cost path

Both firms provide MT5 accounts, and FundedNext documents linking an MT5 account to Myfxbook using the **investor password**. TraderOS can use Myfxbook's read-only API as a common data source for accounts linked there. This avoids asking the user to install TraderOS's EA or keep a local MT5 terminal running.

- FundedNext investor-password linking instructions: https://help.fundednext.com/en/articles/8019804-can-i-add-my-fundednext-trading-account-to-myfxbook
- Myfxbook API documentation: https://www.myfxbook.com/my/api
- Myfxbook MT5 update modes: https://www.myfxbook.com/help/knowledge-base/metatrader-5-connection-methods/

TenTrade support is contingent on the user's MT5 account/server being accepted by Myfxbook. This must be verified with a real TenTrade account before advertising it as supported.

## Important constraints

1. **This is a backend API client foundation, not a completed user-facing integration.** OAuth/credential onboarding, secure credential storage, polling, canonical trade mapping, idempotent import, and UI still need implementation.
2. Myfxbook's documented `get-history` API exposes the last 50 transactions. Polling frequently and deduplicating may work for active accounts, but this is not a guaranteed full historical backfill.
3. Myfxbook says API sessions are IP-bound. The deployed backend therefore needs stable outbound IP behavior or session creation may fail across deploys/instances.
4. Myfxbook API login uses the user's Myfxbook email/password. Never request or store the MT5 master password. Prefer a dedicated Myfxbook account and encrypt any credentials/session tokens at rest; do not log them.
5. Myfxbook offers a free Auto Update mode that updates roughly daily, while its real-time server-side Live Update is paid. TraderOS cannot promise real-time sync at $0/month using that paid mode.
6. This integration is read-only and must never place, modify, or close orders.

## Rollout gate

Before enabling the connection UI:
- Verify the specific FundedNext and TenTrade MT5 servers can be linked through investor access.
- Confirm Myfxbook API terms and the deployed backend's IP stability.
- Implement encrypted secret storage, account ownership checks, disconnect/revocation, rate-limited sync, duplicate-proof imports, and tests for partial history.
- Clearly label the update cadence based on the actual Myfxbook connection method (daily free mode versus paid real-time mode).
