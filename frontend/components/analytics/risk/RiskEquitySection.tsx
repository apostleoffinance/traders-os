"use client";

import { useMemo } from "react";
import { Stat } from "@/components/ui";
import { ChartCard } from "@/components/trader";
import { Empty } from "@/components/analytics/Charts";
import { EquityCurve } from "@/components/visualizations/performance/EquityCurve";
import { UnderwaterCurve } from "@/components/visualizations/risk/UnderwaterCurve";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { generateEquityInsight, resolveVizCopy } from "@/lib/visualization";
import { getPerformanceMetrics } from "@/lib/analytics/view-models";
import { money, num } from "@/lib/format";

/**
 * Risk-owned equity + underwater (uPlot). Recovery research stays in deep dive.
 */
export function RiskEquitySection({ data }: { data: AnalyticsDashboard }) {
  const eq = data.lab?.equity;
  const currency = data.account.currency;
  const equityCopy = resolveVizCopy("equity_curve");
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
      <ChartCard title={equityCopy.title} question="How deep is my drawdown over time?" tier="essential">
        <Empty>Close more trades to see equity and underwater curves.</Empty>
      </ChartCard>
    );
  }

  const dd = eq.drawdown;

  return (
    <>
      <ChartCard
        title="Equity & capital path"
        question="How has account equity moved under this filter?"
        tier="essential"
        interactive
        insight={insight}
        subtitle="Same equity series as Performance — shown here with drawdown context for risk decisions."
      >
        <EquityCurve curve={netCurve} markers={eq.markers ?? []} currency={currency} defaultRange="ALL" />
        <div className="stats">
          <Stat label="Max drawdown" value={money(dd.max_drawdown, currency)} tone="neg" />
          <Stat label="Max DD %" value={dd.max_drawdown_pct ? `${num(dd.max_drawdown_pct, 1)}%` : "—"} tone="neg" />
          <Stat label="Current DD" value={money(dd.current_drawdown, currency)} tone="neg" />
          <Stat label="DD periods" value={String(dd.episodes.n_episodes)} />
        </div>
      </ChartCard>

      <ChartCard
        title="Underwater equity"
        question="How deep am I below peak equity?"
        tier="essential"
        interactive
        subtitle="Drawdown depth below the running peak. Drag to select a window; click a day to inspect trades."
      >
        {dd.curve.length >= 2 ? (
          <UnderwaterCurve curve={dd.curve} currency={currency} />
        ) : (
          <Empty>Not enough points to plot underwater equity.</Empty>
        )}
      </ChartCard>

      <style jsx>{`
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }
      `}</style>
    </>
  );
}
