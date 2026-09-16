# TraderOS product components (`components/trader`)

Path A Phases 2–6 — domain UI for trading surfaces.

| Export | Role |
|--------|------|
| `MetricCard` / `ChartCard` / `InsightCard` | Decision numbers + chart shell + WHAT/SO WHAT/NOW WHAT |
| `RankList` | Top-N expectancy ranks (DOM) |
| `RiskBudget` | L1 risk-limit utilization |
| `FilterBar` / chips | Period + drill-down filters |
| `InvestigationQueue` | Deterministic next actions |
| `DecisionStrip` / answer strips | Tab L1 answers |
| `TraderOSTable` | TanStack Table v8 shell (sort, density, pagination) |
| `TradeTable` / `ResearchTable` / `ReportTable` | Domain tables |
| `EmptyState` / `LoadingState` | Shared empty/loading |

Prefer `@/components/trader`. Legacy analytics paths re-export for compatibility.
