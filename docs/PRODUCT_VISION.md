# TraderOS — Product Vision and Build Specification

## Product thesis

TraderOS is a personal trading intelligence system for individual FX and crypto traders. The journal is the first data-capture layer, not the end product.

It connects market context, the trader's decision, actual execution, the trade outcome, and evidence-based research into one continuous learning loop. It should help a trader understand not only what happened, but what the trader's own data can reliably say about why it happened and what process improvements are worth testing.

**Product promise:** Turn a trader's history into a trusted, inspectable feedback loop for better research, risk discipline, and execution.

TraderOS is not a signal-selling product, a generic portfolio tracker, or an AI chatbot that invents trading advice. It is a system of record plus deterministic quantitative analysis and a constrained AI research assistant.

## Target user and initial wedge

### Primary user
An individual FX or crypto trader who wants to improve performance, discipline, and risk management using their own trading history. This includes discretionary traders and traders working within funded/prop-firm account rules.

### Initial wedge
Be Forex-native and MT5-first. Make trade capture/import, performance attribution, prop-account risk, and evidence-backed personal insights unusually reliable. Build the instrument/data model so crypto can share the core product without pretending FX and crypto market structure are identical.

### User jobs
- Reconcile what actually happened in a trade across plans, orders, fills, costs, and exits.
- Understand performance by strategy/setup, instrument, session, weekday, direction, holding time, and market condition.
- Track risk limits and funded-account rules before a breach occurs.
- Review a trade with chart context and the original thesis.
- Discover repeatable patterns with sample sizes and supporting trades.
- Turn findings into a testable process change and measure whether it helped.

## Product pillars

### 1. Trading Workspace
The trader's landing point, not a wall of unrelated cards. Show selected account, current-period results, current risk/limit utilization, recent activity, sync/data health, and the most useful next action. Clearly separate realized results from open exposure and account equity.

### 2. Journal and Trade Lifecycle
Manual entry and broker/exchange imports feed one canonical trade history. A trade should connect:
- Planned thesis and setup
- Planned entry, stop, target, size, and risk
- Actual orders, fills, exits, fees, swap/funding, and slippage when available
- Market snapshot around decision, entry, and exit when data coverage allows
- Screenshots/notes and post-trade review
- Process quality and rule adherence, kept distinct from profit/loss

Imports must be idempotent and reconcilable. Preserve source IDs and original records for auditability. Do not collapse orders, fills, positions, and completed trades into one ambiguous object.

### 3. Performance Intelligence
Go beyond aggregate P&L. Provide expectancy in R, profit factor, drawdown, win/loss distribution, payoff ratio, MAE/MFE, holding time, and costs where supported. Allow breakdowns by setup/strategy, instrument, session, weekday, direction, timeframe, and selected market regime.

Every insight must disclose its date range, filters, trade count, missing-data limitations, and whether the observed difference is descriptive rather than causal. Make it easy to open the trades behind a metric.

### 4. Portfolio and Risk OS
A cross-account view of equity, realized/unrealized P&L, open exposure, planned risk, actual risk, drawdown, and configured account limits. Support funded-account rules as versioned templates or explicit user-configured rules; do not hardcode assumptions from a firm's marketing page as timeless truth.

Risk calculations remain server-side and deterministic. Explain units and currencies, and distinguish a warning from a hard restriction. No silent changes to account rules.

### 5. Strategy Research Lab
Let traders define and compare strategy/setup cohorts, evaluate performance under different conditions, and formulate hypotheses from their history. Start with transparent descriptive analysis; later add robust backtesting, transaction-cost modeling, out-of-sample validation, and walk-forward analysis.

Do not label a small sample as an edge. Display sample-size warnings and uncertainty. Separate exploration from validation to reduce overfitting.

### 6. Market Workstation and Context
Provide a market workspace for instrument lookup, watchlists, candles, timeframes, and trade-linked chart context. Start with a clearly labeled FX data path and a clearly labeled crypto data path. Show provider, timeframe, timezone, freshness, and gaps. Never present synthetic or stale data as live.

Treat market data as provider adapters behind stable interfaces. Prefer trade-linked snapshots and appropriately scoped OHLCV history over indiscriminate permanent storage of every tick.

### 7. Personal AI Researcher
The AI assistant answers questions about the trader's own validated history, such as:
- “Which setups have had the strongest expectancy over my last 100 closed trades?”
- “What differs between my planned risk and actual risk?”
- “Show evidence for my London-session results compared with New York.”
- “Which rule violations correlate with my largest losses in this sample?”

The AI must use approved analytics tools and structured evidence, not unrestricted SQL or unverified model calculations. Answers should include the exact filters, sample size, metric definitions, caveats, and links to supporting trades. It must not generate buy/sell signals, claim certainty, or infer causation from correlation. When data is insufficient, say so.

### 8. Replay, Integrations, and Data Trust
Replay should connect a trade to available historical candles and the decision timeline, with clear disclosure of gaps and source limitations. MT5 is the initial broker integration. Add read-only exchange/broker imports and reconciliation before considering live order execution.

Live execution is a separate future risk/security project, not an automatic extension of the journal.

## Core product loop

1. **Capture:** Import or record the trader's real activity.
2. **Contextualize:** Attach the plan, market snapshot, session, costs, and relevant conditions where data exists.
3. **Measure:** Calculate outcomes with deterministic and tested quant logic.
4. **Investigate:** Filter, compare, drill into supporting trades, and inspect data quality.
5. **Learn:** Use AI to explain validated findings, with evidence and limitations.
6. **Experiment:** Turn a finding into a process hypothesis and compare subsequent results without overstating causality.

## Information architecture

Organize the application around trader intent rather than an ever-growing list of features:

- **Workspace:** Account snapshot, risk state, sync health, recent activity, next actions.
- **Journal:** Trade blotter, new trade, import/sync, trade detail, replay and review.
- **Research:** Analytics, Calendar, Strategy Research, reports and AI Researcher.
- **Market:** Charts, watchlists, instrument context and data status.
- **Risk:** Account rules, drawdown, exposure and limit utilization.
- **Manage:** Accounts, integrations, preferences and settings.

Existing routes should be preserved while navigation changes. Each page should have one clear primary task and contextual links to the next stage of the loop.

## Delivery plan and acceptance criteria

### Release 1 — Trusted FX journal and intelligence foundation
- Make the core path from account setup → MT5/manual capture → review → analytics coherent.
- Make the workspace answer “How am I doing, what risk am I carrying, and what should I review next?”
- Make every major metric drill down to its source trades.
- Make account and period context consistent across journal, analytics, and risk.
- Validate FX P&L/R calculations, timezone handling, duplicate import behavior, and account isolation with regression tests.
- Ship only when frontend type-check/build and relevant backend tests pass.

### Release 2 — Personal performance intelligence
- Unify analytics filters and definitions.
- Add transparent comparisons across setup, session, instrument, direction, and holding-time cohorts where data supports them.
- Include sample-size and data-quality messaging by default.
- AI answers must reference computed results and supporting trades, and decline unsupported questions.

### Release 3 — Risk OS and stronger execution attribution
- Add a unified risk view across accounts.
- Show configured rule utilization and projected risk before entry when the inputs are sufficient.
- Improve reconciliation of broker fills, costs, and completed trades.
- Distinguish realized P&L, unrealized P&L, open exposure, planned risk, and actual risk.

### Release 4 — Market context and replay
- Standardize instrument and OHLCV provider interfaces.
- Add watchlists and reliable chart context with visible data provenance.
- Link trade timeline to historical candles when coverage exists.
- Add FX first and crypto adapters without mixing their different units, sessions, and cost models.

### Release 5 — Strategy research and validated backtesting
- Allow strategy cohorts and hypotheses to be evaluated against clean, reproducible datasets.
- Model fees, spread, slippage, swap/funding, and other material costs when data is available.
- Include out-of-sample and walk-forward evaluation, data-snooping warnings, and robust result exports.

### Later — Execution automation
Only consider live execution after the record model, reconciliation, permissions, risk checks, observability, and failure recovery are separately designed and tested.

## Non-negotiable engineering principles

- PostgreSQL is the canonical record store.
- Persist money, price, quantity, and rate values using suitable decimal/numeric types, not binary floating point.
- Store timestamps in UTC and render in the user's selected IANA timezone.
- Normalize instruments while preserving original provider symbols.
- Keep planned values distinct from actual values.
- Preserve raw import/source identifiers for idempotency and reconciliation.
- Separate orders, fills, positions, and completed trades where the domain requires it.
- Deterministic Python engines own core financial and quantitative calculations; frontend code formats and visualizes results.
- Version important market snapshots when linked to a trade decision, order, fill, or exit.
- AI consumes validated metrics and evidence packages; it does not calculate financial truth or access arbitrary SQL.
- Enforce per-user authorization and test cross-user isolation.
- Never fabricate market data, trades, performance values, or evidence.
- Avoid replacing the existing architecture unless an observed limitation justifies the cost and migration risk.

## Success measures

Track product quality with measures tied to the core loop:
- Time from connecting/importing an account to a reconciled first useful review.
- Percentage of imported records reconciled without duplicates or unexplained differences.
- Percentage of important analytics that can drill down to supporting trades.
- User ability to identify and explain a performance pattern with its sample size and limitations.
- Reduction in missing review/context fields over time, without penalizing users for data unavailable from their broker.
- Reliability of calculations, sync jobs, account isolation, and market-data freshness.
- AI answer evidence coverage and rate of appropriate abstention on insufficient data.

Avoid optimizing for the number of cards, features, or AI messages shipped. The product wins when traders can trust the data and make better-informed process decisions.
