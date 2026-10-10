# Research Context Contract

Analytics, Intelligence, and Quant Lab responses should disclose the cohort used to calculate each result.

## Shared fields

- `timezone`: timezone used to interpret date filters.
- `filters`: resolved period, dates, instrument, session, setup, direction, timeframe, psychology and result filters.
- `population.account_trades`: number of account records before filters.
- `population.filtered_trades`: records after the selected filters.
- `population.closed_trades`: closed trades with an exit timestamp in the cohort.
- `population.closed_trades_with_pnl`: closed trades with realized P&L available.
- `population.closed_trades_missing_pnl` and `closed_trades_missing_r`: missing-data counts.
- `sample`: deterministic evidence level and explanation from the shared evidence engine.
- `limitations`: human-readable warnings for empty samples, small samples, and incomplete metrics.

## Interpretation rules

1. Always disclose the cohort and timezone before interpreting comparisons.
2. Open/unclosed trades do not count as closed performance observations.
3. Missing P&L and missing R are separate data-quality problems; a trade can have P&L but no defensible R multiple.
4. Sample evidence describes historical support, not predictive certainty. A larger sample does not prove causation or guarantee future performance.
5. Existing statistic-specific thresholds may be stricter than the shared context label. The context must not override a metric's own confidence interval, data-quality checks, or minimum sample requirement.
6. The frontend must render the same cohort context consistently across Analytics, Quant Lab and Intelligence. Drilldowns must retain the selected account, period and filters.

## Current API placement

- Analytics dashboard: top-level `research_context`.
- Intelligence: top-level `research_context`.
- Quant Lab: `meta.date_range.research_context`, next to the resolved date window.

This is an additive response contract; it does not change financial calculations or create trading signals.

## Metric-specific sample sizes

The shared `sample` uses closed observations with realized P&L. The separate `r_sample` uses closed observations with an R multiple. These counts can differ and must not be silently substituted for each other. Each statistic's own data-quality and minimum-sample requirements remain authoritative.
