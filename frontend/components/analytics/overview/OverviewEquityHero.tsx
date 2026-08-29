"use client";

import { useMemo } from "react";
import { Stat } from "@/components/ui";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { Empty } from "@/components/analytics/Charts";
import { EquityInteractiveChart } from "@/components/analytics/primitives/EquityInteractive";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { generateEquityInsight } from "@/lib/analytics/insights/generators";
import { getAnalyticsDefinition } from "@/lib/analytics/registry";
import { getPerformanceMetrics } from "@/lib/analytics/view-models";
import { money, num, tone } from "@/lib/format";

export function OverviewEquityHero({ data }: { data: AnalyticsDashboard }) {
  const eq = data.lab?.equity;
  const currency = data.account.currency;
  const o = data.overview;
  const def = getAnalyticsDefinition("equity_curve");
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
      <ChartCard title={def?.title ?? "Equity curve"} question={def?.primaryQuestion} tier={def?.tier}>
        <Empty>Close more trades to see your equity curve.</Empty>
      </ChartCard>
    );
  }

  const dd = eq.drawdown;

  return (
    <ChartCard
      title={def?.title ?? "Equity curve"}
      question={def?.primaryQuestion ?? "Is my account growing consistently?"}
      tier={def?.tier}
      interactive
      insight={insight}
    >
      <div className="hero">
        <div className="chart">
          <EquityInteractiveChart
            netCurve={netCurve}
            grossCurve={eq.gross_pnl.curve}
            markers={eq.markers ?? []}
            mode="net_pnl"
            currency={currency}
          />
        </div>
        <aside className="snapshot">
          <h3 className="snap-title">Snapshot</h3>
          <Stat label="Net P&L" value={money(o.net_pnl, currency)} tone={tone(o.net_pnl)} />
          <Stat label="Profit factor" value={o.profit_factor ? num(o.profit_factor) : "—"} />
          <Stat label="Expectancy" value={o.expectancy_r ? `${num(o.expectancy_r)}R` : "—"} tone={tone(o.expectancy_r)} />
          <Stat label="Average R" value={o.average_r ? `${num(o.average_r)}R` : "—"} />
          <Stat label="Max drawdown" value={money(dd.max_drawdown, currency)} tone="neg" />
          <Stat label="Current drawdown" value={money(dd.current_drawdown, currency)} />
        </aside>
      </div>
      <style jsx>{`
        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 200px;
          gap: 20px;
          align-items: start;
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
