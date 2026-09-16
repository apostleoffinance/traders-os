"use client";

import { useMemo } from "react";
import { Stat } from "@/components/ui";
import { ChartCard } from "@/components/trader";
import { Empty } from "@/components/analytics/Charts";
import { EquityCurve } from "@/components/visualizations/performance/EquityCurve";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { generateEquityInsight, resolveVizCopy } from "@/lib/visualization";
import { getPerformanceMetrics } from "@/lib/analytics/view-models";
import { money, num, tone } from "@/lib/format";

export function OverviewEquityHero({ data }: { data: AnalyticsDashboard }) {
  const eq = data.lab?.equity;
  const currency = data.account.currency;
  const o = data.overview;
  const copy = resolveVizCopy("equity_curve");
  const insight = useMemo(() => {
    const m = getPerformanceMetrics(data);
    return generateEquityInsight({
      netPnl: m.netPnl,
      maxDrawdown: m.maxDrawdown,
      currentDrawdown: m.currentDrawdown,
      trades: m.trades,
    });
  }, [data]);

  if (!eq) return null;

  const netCurve = eq.net_pnl.curve;
  if (netCurve.length < 2) {
    return (
      <ChartCard title={copy.title} question={copy.question} tier="essential">
        <Empty>Close more trades to see your equity curve.</Empty>
      </ChartCard>
    );
  }

  const dd = eq.drawdown;

  return (
    <ChartCard
      title={copy.title}
      question={copy.question}
      tier="essential"
      interactive
      insight={insight}
      subtitle="Account growth over time. Use the range controls to focus recent performance."
    >
      <div className="hero">
        <div className="chart">
          <EquityCurve
            curve={netCurve}
            markers={eq.markers ?? []}
            currency={currency}
            defaultRange="ALL"
          />
        </div>
        <aside className="snapshot">
          <h3 className="snap-title">Snapshot</h3>
          <Stat label="Net P&L" value={money(o.net_pnl, currency)} tone={tone(o.net_pnl)} />
          <Stat label="Profit factor" value={o.profit_factor ? num(o.profit_factor) : "—"} />
          <Stat label="Expectancy" value={o.expectancy_r ? `${num(o.expectancy_r)}R` : "—"} tone={tone(o.expectancy_r)} />
          <Stat label="Max drawdown" value={money(dd.max_drawdown, currency)} tone="neg" />
          <Stat label="Current drawdown" value={money(dd.current_drawdown, currency)} />
        </aside>
      </div>
      <style jsx>{`
        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 180px;
          gap: 20px;
          align-items: start;
        }
        .chart {
          min-width: 0;
        }
        .snap-title {
          margin: 0 0 10px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
        }
        .snapshot :global(.stat) {
          margin-bottom: 8px;
        }
        @media (max-width: 900px) {
          .hero {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </ChartCard>
  );
}
