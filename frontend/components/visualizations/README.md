# Visualization architecture

TraderOS uses a shared visualization layer so charts stay trader-native and library choices stay intentional.

## Libraries

| Library | Use |
|---------|-----|
| **uPlot** | Equity, drawdown/underwater, rolling expectancy, sparklines |
| **ECharts** | Heatmaps, histograms, scatters, categorical ranks (deep), Monte Carlo — via `InteractiveChart` only |
| **DOM** | Rank lists, calendars, risk budget bars, scorecards |
| **Vela** | Market candles / OHLCV / drawings — only via `MarketChart` (`/labs/vela` POC) |

visx is reserved for rare bespoke product visuals — not required for current surfaces.

**Do not** use ECharts for equity or underwater curves. Owned components: `EquityCurve`, `UnderwaterCurve`.

## Chart selection

Rules live in `lib/visualization/chart-selection.ts`:

| Job | Library |
|-----|---------|
| Time series | uPlot |
| Statistical analysis | ECharts |
| Market OHLC | Vela |
| Simple metric | MetricCard / Stat (DOM) |
| Ranking | RankList (DOM) |
| Risk allocation | RiskBudget / LimitBar (DOM) |
| Simple comparison | DOM bars |
| Custom visual | SVG/DOM first |

Per-viz metadata (question, library, component, tier, interactions) lives in `lib/visualization/registry.ts` — the source of truth.

## Layout

- `lib/visualization/` — types, registry, chart-selection, formatters, colors, tooltips, thresholds, insight bridge
- `components/visualizations/{performance,edge,risk,behaviour,execution,trade,quant,market}/` — presentational components
- `components/trader/` — ChartCard, MetricCard, RankList, RiskBudget, …

## Rules

1. Every visualization answers one trader question (see registry).
2. Prefer progressive disclosure: human answer → visual evidence → quant detail.
3. Do not load Vela or Quant heavy charts on Overview.
4. Prefer owned components over raw `<ReactECharts />` / `<uPlot />` at page level.
5. AI explains metrics; it does not invent them.
