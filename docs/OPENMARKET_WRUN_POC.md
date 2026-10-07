# OpenMarket Wrun evaluation and TraderOS replay proof of concept

**Decision: do not make Wrun a core TraderOS dependency yet.** The integration gate remains open until OpenMarket provides a supported external API/SDK contract and confirms the required FX coverage.

## What the supplied Wrun material establishes

The supplied [Wrun overview](https://openmarket.xyz/wrun) and [“What you can read” documentation](https://openmarket.xyz/wrun/core-concepts/what-you-can-read) describe a market-logic and indicator environment. The screenshot groups its documentation into Get started, Market data, Indicators, Chart output, Settings, Strategies, Cookbook, Language, and Reference. It says feeds can expose candles, tape, book, liquidations, and options.

This is evidence of a rich scripting/data environment inside Wrun. It does not, by itself, establish a supported external HTTP/WebSocket API that TraderOS can call from its backend, data redistribution rights, or a stable symbol/timeframe contract for both FX and crypto. The documentation pages could not be retrieved by the automated browser during this implementation, so exact API paths, authentication, rate limits, retention, and data terms remain unverified. No Wrun endpoint has been guessed or hard-coded.

Public product descriptions surfaced during research emphasize crypto venues, derivatives, order flow, funding, open interest, liquidations, and replay. These are potentially valuable for crypto research, but do not confirm an external FX candle feed. Wrun's in-platform coverage and an API contract for an external application are separate questions.

## Proof of concept implemented in TraderOS

The existing canonical market candle table (market_candles) and provider chain are reused. No parallel candle database or vendor-specific schema was added.

### Endpoint

POST /api/market/replay-window

Example request (illustrative historical range; choose one supported by both feeds):

    {
      "symbols": ["EURUSD", "BTCUSDT"],
      "timeframe": "M5",
      "start": "2026-09-01T08:00:00Z",
      "end": "2026-09-01T12:00:00Z",
      "limit": 500
    }

The route is wired into the new Market Replay screen at /labs/replay and uses the existing authenticated API. It fetches both series before writing, persists candles to market_candles, commits both datasets atomically, and returns:
- the exact UTC replay window;
- FX and crypto source/provider names and per-series coverage;
- normalized OHLCV values with exact decimal strings;
- a deterministic timestamp/symbol-sorted replay tape;
- explicit caveats about provider differences and candle-level replay precision.

If either instrument cannot be fetched, the request fails and rolls back instead of returning a misleading partial replay. FX and crypto bars remain sourced from their own providers; they are not represented as one consolidated order book. The current adapter chain is Dukascopy for FX and configured CCXT exchanges for crypto.

### Try it in the UI

1. Sign in to TraderOS and open Market Replay from the Market section of the sidebar, or navigate to /labs/replay.
2. Choose one FX symbol, one crypto symbol, a timeframe, and a historical UTC window, then select Load & persist replay.
3. Step through events, play/pause the timeline, and drag the scrubber. The two candlestick panels reveal only bars at or before the current replay cursor.
4. Confirm both providers and candle counts are displayed, and review the precision caveats below the chart.

### Try the API directly

1. Sign in and obtain a TraderOS bearer token.
2. Choose a historical UTC interval likely to have FX and crypto candles (avoid a weekend-only window for FX).
3. Send the request to /api/market/replay-window with Authorization: Bearer <token>.
4. Confirm status is ok, both series are present, persisted_to is market_candles, and timeline timestamps are monotonic.
5. Query the existing market candle storage for the returned symbols, providers, timeframe, and timestamp interval to verify durable persistence.

### Run the real-provider/database smoke test

Automated unit tests use fake providers. To validate actual upstream fetches and durable persistence, run the live smoke test in an environment with the backend dependencies installed, a migrated PostgreSQL database, and outbound network access:

    cd backend
    python scripts/smoke_market_replay.py

It defaults to EURUSD + BTCUSDT on M5 over a recent four-hour UTC interval. If the provider has gaps or a temporary outage, choose a historical interval that overlaps an FX trading session:

    python scripts/smoke_market_replay.py --timeframe M15 --hours 24
    python scripts/smoke_market_replay.py --start 2026-10-05T08:00:00Z --end 2026-10-05T12:00:00Z

The script calls the real provider adapters and replay service, persists to `market_candles`, queries the database to verify both returned series are present, and checks replay timestamp ordering. It prints a machine-readable PASS/FAIL report and exits non-zero on failure. It writes real market candles to the configured database; run it against development/staging first, not a production database.

**Important:** a passing report validates TraderOS's current Dukascopy/CCXT chain. It deliberately reports `wrun_integration: NOT_TESTED`; it does not imply that Wrun was called or validated.

### Acceptance criteria

- [x] Exactly one supported FX symbol and one supported crypto symbol are required.
- [x] Explicit timezone-aware window; end must be after start.
- [x] Decimal candle values serialized without binary-float conversion.
- [x] Both series fetched before persistence; all-or-nothing database commit.
- [x] Stable replay event ordering by timestamp then symbol.
- [x] Automated tests cover mixed-asset validation, persistence, ordering, and rollback.
- [ ] Live provider smoke test against external feeds (requires a running backend, database, and outbound network).
- [ ] Wrun integration test against a documented Wrun API/SDK and a confirmed FX instrument.
- [ ] Legal/technical confirmation of storage, replay, and redistribution rights.

## Why the Wrun gate is not passed

TraderOS must not infer a callable data API from an in-product scripting environment. Before writing a Wrun adapter, request from OpenMarket:
1. Official external API/SDK docs and base URL;
2. Authentication and rate limits for live and historical candles;
3. Supported FX symbols, including whether quotes are broker-specific or generic;
4. Historical depth, intervals, timestamps, corrections, and missing-bar semantics;
5. Bid/ask or tick data access if execution replay is expected;
6. Storage, caching, derived-data, and redistribution permissions;
7. Stable identifiers and versioning/deprecation policy.

Until those are answered and the live smoke test passes, Wrun remains an evaluated research tool, not a core dependency. TraderOS continues to use its provider-neutral market-data boundary so a Wrun adapter can be added later without coupling the journal, risk engine, or replay storage to it.
