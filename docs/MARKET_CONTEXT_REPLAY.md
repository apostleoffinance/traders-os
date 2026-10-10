# Trade-Linked Market Context and Replay

## Data path

Trade replay uses the canonical trade record and requests historical M1 OHLC candles for the trade hold window. FX candles route through the Dukascopy-first chain with OANDA fallback when enabled; crypto candles use the configured CCXT exchange adapters. The provider name is preserved with each candle and in the replay snapshot.

## Provenance and gaps

Replay responses disclose the selected provider, timeframe, requested window, first/last returned candle, source bar count, and whether the displayed path was downsampled. Timestamp intervals between M1 bars are reported rather than filled synthetically.

- Shorter intraday gaps are listed with timestamps and an approximate missing-bar count.
- Long FX intervals are shown separately because they may reflect scheduled market closures or unavailable data.
- Crypto is treated as a 24/7 market, so long gaps remain visible as data gaps.
- The system does not estimate a coverage percentage when expected market-open intervals cannot be reliably inferred.

## Immutable snapshots

When candles are available, TraderOS stores a versioned `TradeMarketSnapshot` linked to the user, account, and canonical trade. Each version includes:

- provider, timeframe, requested window and capture time;
- source candle count, gap summary and SHA-256 fingerprint of the full returned candle series;
- a stable display series, timed excursions and trade price levels.

Repeated replay requests with the same candle fingerprint reuse the existing snapshot. A changed candle series creates a new version; previous snapshots are not overwritten. Snapshot persistence is best-effort and does not change trade P&L or other financial records.

## Limits

The replay is historical OHLC context, not tick reconstruction. It does not prove that the trade would have filled at the displayed prices and cannot recover bid/ask spread, intrabar ordering, or executable slippage from candles alone. Downsampled points are for visualization; the fingerprint is calculated from the full returned source series.

Open trades or records without both entry and exit timestamps are explicitly marked not applicable for hold-window snapshot capture; they are not reported as provider failures.
