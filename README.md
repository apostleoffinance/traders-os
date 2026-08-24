# Trader OS

Personal trading journal, risk monitor, and performance intelligence. Built so it can later become a multi-user SaaS. It is **not** a signal generator and it does **not** encourage trading.

**No setup = no trade.**

A losing trade can still be a high-discipline trade. A winning trade can still be a poor one. Performance and discipline are scored separately.

---

## Current repository

Greenfield V1. Stack:

| Layer | Choice |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript (Vercel) |
| Backend | FastAPI, Pydantic, SQLAlchemy, Alembic (Render) |
| Database | PostgreSQL |
| Charts | Apache ECharts |
| Storage | Object-storage interface (`local` now, `s3` later) |
| Auth | JWT access + refresh, bcrypt passwords, per-row `user_id` |

---

## Architecture

```text
Next.js  ──HTTPS/REST──►  FastAPI
                              ├── Session Engine
                              ├── FX math (pips, P/L, R)
                              ├── Account Rules Engine
                              ├── Risk Engine
                              ├── Discipline Engine
                              ├── Psychology Engine
                              ├── Performance Engine
                              └── Health Engine
                              ▼
                         PostgreSQL
                         Object storage (screenshots)
```

Business logic lives in `backend/app/engines/` (pure, unit-tested) and `backend/app/services/` (persistence + authz). API routes do not calculate risk, R, or P/L.

### Database (normalized)

- `users` — identity, IANA timezone (default `Africa/Lagos`)
- `accounts` — firm, program, balances, status
- `account_risk_profiles` — **all** prop-firm and personal limits (never hardcoded in UI)
- `setups` — user-defined classifications (Liquidity Sweep, Structure Break, …)
- `trades` — full journal row, UTC timestamps, auto session, computed metrics, discipline score
- `psychology` — before / during / after + intensity scales
- `trade_screenshots` — metadata only; files in object storage
- `checklist_templates` / `checklist_items` / `trade_checklist_responses`
- `risk_events` — why the desk is green / yellow / red

Every table that holds trader data includes `user_id`. Lookups always filter by the authenticated user. Missing-or-foreign resources return **404** (no cross-tenant enumeration).

### API

```
POST /api/auth/register|login|refresh
GET  /api/auth/me

GET|POST /api/accounts
GET|PATCH /api/accounts/{id}
GET|PUT  /api/accounts/{id}/risk-profile

GET|POST /api/trades
POST     /api/trades/preview      ← live risk / R:R (same engine as persist)
GET|PUT|DELETE /api/trades/{id}
POST|DELETE screenshots

GET /api/dashboard
GET /api/risk/status|daily|drawdown
GET /api/analytics/{overview,session,setup,direction,weekday,psychology,rr,timeframe,holding,equity-curve}
GET /api/instruments
GET /api/setups  GET /api/checklists/default
GET /api/push/config
POST|DELETE /api/push/subscribe
POST /api/push/dispatch          ← cron secret; one journal reminder / day
GET /api/media/{key}              ← auth-gated screenshot bytes
```

### Frontend pages

- `/login` `/register`
- `/dashboard` — how am I doing, am I safe, am I trading too much
- `/trades/new` — live risk calc, checklist, psychology, screenshots
- `/trades` — filterable blotter
- `/trades/[id]` — full journal
- `/risk` — “am I going too hard?”
- `/analytics` — session / setup / psychology / equity curve
- `/intelligence` — optional process coach on journal data
- `/accounts` `/accounts/[id]` — multi-account + editable risk policy
- `/settings`

Preset: **TenTrade TenEdge Instant $1K** (`template=tentrade_tenedge_1k`) loads $5 risk, $10 personal daily loss, $50 personal DD, $60 / $90 firm DD, 2 trades/day, 1.5 min R:R. Change any of these in the account risk policy — they are not compiled into the app.

### Session engine

Classification uses IANA zones (`Europe/London`, `America/New_York`, `Asia/Tokyo`). DST is handled by `zoneinfo`, not WAT clock times. Preferred windows (08:00–11:00 and 13:00–16:00 `Africa/Lagos`) affect discipline and warnings only.

### Metrics

- **Expectancy** = mean realized R
- **Profit factor** = gross profit / gross loss (undefined if no losses)
- **Max drawdown** from the equity-curve high-water mark
- **Sharpe / Sortino** withheld until n ≥ 30

---

## Intelligence (optional)

Server-side only. Set one or more of `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `BAZAARLINK_API_KEY`. Failover order is `AI_PROVIDER_ORDER`. The journal, risk engine and analytics work with no keys.

The model never queries Postgres. It receives a hashed JSON context built from existing engines. It must not emit buy/sell/entry advice; the application rejects that output.

---

## Local development

```bash
cp .env.example .env
# set SECRET_KEY to a long random string

docker compose up -d postgres

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

cd ../frontend
cp ../.env.example .env.local   # or set NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev
```

Open http://localhost:3000 → register → **Accounts** → create TenTrade $1K template → **New trade**.

Optional seed after you have registered:

```bash
cd backend && python -m app.seed --email you@example.com
```

### Tests

```bash
cd backend && pytest -q
```

Covers pip/P/L/R math, drawdown, session DST, discipline independence from P/L, risk warnings, policy confirm/block, and user isolation.

---

## Deploy

**API (Render):** Docker from `backend/Dockerfile` (`alembic upgrade head` then uvicorn). Set `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS` to the Vercel origin. Optional: `GEMINI_API_KEY`. For journal reminders set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`, and `WEB_ORIGIN`. Hit `POST /api/push/dispatch` hourly with `X-Cron-Secret`. The journal, risk engine and analytics work with no AI key and with reminders off.

**Web (Vercel):** Import the GitHub repo, then set **Root Directory** to `frontend` (required). Framework is Next.js. Set `NEXT_PUBLIC_API_URL` to the Render URL. Redeploy after changing Root Directory. A Vercel `404: NOT_FOUND` page means the project was built from the repo root or has no Ready deploy. Do not put provider keys in Vercel.

Screenshots are not stored in Postgres. Swap `STORAGE_BACKEND=s3` when you attach a bucket.

---

## Intentionally not in V1

Broker/MT5 execution, in-app charting terminal, TradingView embed, billing, social, backtesting, Monte Carlo. Gemini remains an optional process coach, not a signal engine.
