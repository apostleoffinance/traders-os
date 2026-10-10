# Strategy Research Experiments

## Endpoint

`POST /api/quant-lab/experiment?account_id=...`

The endpoint uses the same account, period and cohort filters as Analytics/Quant Lab. The body accepts:

- `split_ratio`: chronological in-sample share from 0.50 inclusive to 0.90 exclusive; defaults to 0.70.
- `additional_cost_per_trade`: extra account-currency cost to stress per recorded trade; defaults to zero.

## Output

- `experiment_id`: short deterministic identifier derived from the dataset fingerprint and experiment configuration.
- `dataset_fingerprint`: SHA-256 of the ordered eligible trade identities, timestamps, net P&L, risk/R values and recorded costs.
- `data_quality`: exclusions and missing fields reported by the existing Quant Lab data-quality validator.
- `recorded_costs`: absolute recorded commission and swap totals. These fields are descriptive only; the existing net P&L already includes recorded costs.
- `cost_sensitivity`: results at zero, one-times and two-times the user-specified additional cost per trade.
- `in_sample` / `out_of_sample`: chronological split based on trade exit time, with performance metrics and differences.

## Important limitations

This is a reproducible historical cohort experiment, **not a candle-level backtest**. It cannot infer how changing entry, stop-loss, take-profit or position size would change fills. It does not reconstruct historical bid/ask spread or slippage. The user-supplied additional cost is a sensitivity assumption, not a measured spread/slippage estimate.

Recorded commission and swap are already included in canonical net P&L and must not be deducted twice. The additional cost is applied only as a hypothetical stress. Results are descriptive, subject to sample-size and data-quality limitations, and are not trading signals or proof of future profitability.

A true strategy backtest requires explicit executable rules, clean historical OHLC/tick data, spread and slippage assumptions, fees, financing/funding, instrument specifications, and separate out-of-sample / walk-forward validation.
