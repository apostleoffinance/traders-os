"use client";

import { Stat } from "@/components/ui";
import { MetricCard } from "@/components/analytics/primitives/MetricCard";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { money, num, signed, tone } from "@/lib/format";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";

type DrillMetric = "win_rate" | "expectancy_r" | "profit_factor" | "average_r";

export function AnalyticsOverview({
  data,
  onMetricClick,
}: {
  data: AnalyticsDashboard;
  onMetricClick?: (metric: DrillMetric) => void;
}) {
  const o = data.overview;
  const n = o.n_trades;
  const prior = data.lab?.temporal?.period_comparison;

  function periodDelta(metricLabel: string): string | null {
    if (!prior?.available) return null;
    const row = prior.comparison.find((r) => r.metric.toLowerCase().includes(metricLabel));
    return row?.change ? String(row.change) : null;
  }

  const drill = useOptionalAnalyticsDrilldown();

  return (
    <ChartCard title="Performance overview" sampleSize={n} evidenceLabel={o.evidence.label} interactive>
      <div className="kpis">
        <MetricCard label="Net P/L" value={money(o.net_pnl, data.account.currency)} tone={tone(o.net_pnl)} hint={`n = ${n}`} />
        <MetricCard label="Total R" value={signed(o.total_r, "R")} tone={tone(o.total_r)} />
        <MetricCard
          label="Expectancy"
          value={o.expectancy_r ? `${signed(o.expectancy_r)}R` : "—"}
          tone={tone(o.expectancy_r)}
          delta={periodDelta("expectancy")}
          onClick={onMetricClick ? () => onMetricClick("expectancy_r") : undefined}
        />
        <MetricCard
          label="Win rate"
          value={o.win_rate ? `${num(o.win_rate, 1)}%` : "—"}
          delta={periodDelta("win")}
          onClick={onMetricClick ? () => onMetricClick("win_rate") : undefined}
        />
        <MetricCard
          label="Profit factor"
          value={o.profit_factor ? num(o.profit_factor) : "—"}
          delta={periodDelta("profit")}
          onClick={onMetricClick ? () => onMetricClick("profit_factor") : undefined}
        />
        <MetricCard
          label="Average R"
          value={o.average_r ? `${num(o.average_r)}R` : "—"}
          onClick={onMetricClick ? () => onMetricClick("average_r") : undefined}
        />
        <Stat label="Max drawdown" value={money(o.max_drawdown, data.account.currency)} tone="neg" />
        <Stat label="Current drawdown" value={money(o.current_drawdown, data.account.currency)} />
        <Stat label="Trades" value={String(n)} />
        {drill && (
          <button type="button" className="view-all" onClick={() => drill.openTrades("All filtered trades")}>
            View all trades →
          </button>
        )}
      </div>
      {o.sample_note && <p className="muted">{o.sample_note}</p>}
      <style jsx>{`
        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }
        .view-all {
          grid-column: 1 / -1;
          justify-self: start;
          border: 1px dashed var(--border);
          background: transparent;
          padding: 8px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          color: var(--accent);
        }
        .muted {
          font-size: 13px;
          margin-top: 10px;
        }
      `}</style>
    </ChartCard>
  );
}
