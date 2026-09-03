# Vela chart POC

Isolated proof-of-concept for interactive market charts using [`@luxalgo/vela`](https://luxalgo.com/vela) (Apache-2.0).

## Goals

- Reuse existing provider-agnostic market data (`GET /api/market/ohlcv`) — do not invent a parallel candle API.
- Keep ECharts analytics charts untouched; Vela lives only behind `components/charts/vela/` and `/labs/vela`.
- Forex primary path: Dukascopy (then OANDA if configured). Crypto: CCXT chain; optional Vela Binance provider for crypto-only comparison.
- Never merge bars from two providers into one series.
- Avoid `@luxalgo/vela-pinets` (AGPL). Use native EMA/RSI only.

## Route

- App: `/labs/vela` (terminal shell, auth required)
- Nav: Intelligence → **Vela Lab**
- Status hint: `GET /api/market/status` → `chart_poc` + `ohlcv` chains

## Architecture

```
Browser VelaChart
  └─ NaviqDataProvider (lib/chart/vela/naviqProvider.ts)
       └─ GET /api/market/ohlcv?symbol=&timeframe=&limit=&provider=
            └─ MarketDataService.get_ohlcv (preferred_provider optional)
                 ├─ FX: Dukascopy → OANDA
                 └─ Crypto: CCXT (binance, …)
```

Optional POC path: register Vela’s built-in `BinanceProvider` and set symbol `binance:BTCUSDT` (crypto only; bypasses NAVIQ API).

## Timeframes

| Backend | Vela |
|---------|------|
| M1      | 1    |
| M5      | 5    |
| M15     | 15   |
| M30     | 30   |
| H1      | 60   |
| H4      | 240  |
| D1      | 1D   |

## Frontend layout

| Path | Role |
|------|------|
| `lib/market-data/` | HTTP client + types + TF maps |
| `lib/chart/vela/` | Bars adapter, NAVIQ provider, trade overlay helpers |
| `components/charts/vela/VelaChart.tsx` | Only React surface that imports `@luxalgo/vela` |
| `app/(terminal)/labs/vela/page.tsx` | POC UI |

## Features exercised

- Candles via NAVIQ OHLCV
- Optional `provider=` override
- Live poll (forming candle) through provider `subscribe`
- Drawings toolbar (trendline, hline, …)
- Native EMA 20 + RSI 14
- Trade overlay: Entry / SL / TP / Exit hlines (+ entry vline) from journal trade / replay
- Theme follows Trader OS light/dark
- Attribution: built-in Vela mark + footer link (Apache NOTICE)

## Provider override

```http
GET /api/market/ohlcv?symbol=EURUSD&timeframe=H1&limit=500&provider=dukascopy
```

If the named provider cannot serve the symbol, the API returns provider unavailable with the available chain listed.

## Out of scope (POC)

- Replacing Analytics Lab ECharts
- Pine / AGPL scripting
- Production WebSocket streaming (poll only)
- Multi-chart workspace / layout persistence as product default

## License

`@luxalgo/vela` is Apache-2.0. Keep the NOTICE attribution visible on every screen that renders a Vela chart.
