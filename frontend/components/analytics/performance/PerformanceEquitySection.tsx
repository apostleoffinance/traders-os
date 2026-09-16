"use client";

import { useMemo, useState } from "react";
import { Stat } from "@/components/ui";
import { ChartCard } from "@/components/trader";
import { Empty } from "@/components/analytics/Charts";
import { EquityCurve } from "@/components/visualizations/performance/EquityCurve";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { generateEquityInsight, resolveVizCopy } from "@/lib/visualization";
import { getPerformanceMetrics } from "@/lib/analytics/view-models";
import { money, num } from "@/lib/format";

type CurveMetric = "equity" | "cumulative_r";

/** Performance-owned equity curve (uPlot) with net $ / cumulative R toggle. */
export function PerformanceEquitySection({ data }: { data: AnalyticsDashboard }) {
  const eq = data.lab?.equity;
  const currency = data.account.currency;
  const [metric, setMetric] = useState<CurveMetric>("equity");
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
      <ChartCard title={copy.title} question="How did my account perform over time?" tier="essential">
        <Empty>Close more trades to see your equity curve.</Empty>
      </ChartCard>
    );
  }

  const dd = eq.drawdown;

  return (
    <ChartCard
      title={copy.title}
      question="How did my account perform over time?"
      tier="essential"
      interactive
      insight={insight}
      subtitle="Primary performance curve for this filter. Switch to R to see risk-adjusted progression."
      actions={
        <div className="modes">
          <button type="button" className={metric === "equity" ? "on" : ""} onClick={() => setMetric("equity")}>
            Net $
          </button>
          <button
            type="button"
            className={metric === "cumulative_r" ? "on" : ""}
            onClick={() => setMetric("cumulative_r")}
          >
            Cumulative R
          </button>
        </div>
      }
    >
      <EquityCurve
        curve={netCurve}
        markers={eq.markers ?? []}
        currency={currency}
        metric={metric}
        defaultRange="ALL"
      />
      <div className="stats">
        <Stat label="Max drawdown" value={money(dd.max_drawdown, currency)} tone="neg" />
        <Stat label="Max DD %" value={dd.max_drawdown_pct ? `${num(dd.max_drawdown_pct, 1)}%` : "—"} tone="neg" />
        <Stat label="Current DD" value={money(dd.current_drawdown, currency)} />
        <Stat label="DD periods" value={String(dd.episodes.n_episodes)} />
      </div>
      <style jsx>{`
        .modes {
          display: flex;
          gap: 4px;
        }
        .modes button {
          border: 1px solid var(--border);
          background: transparent;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          color: var(--text-muted);
        }
        .modes button.on {
          background: var(--accent);
          color: var(--accent-contrast, #fff);
          border-color: var(--accent);
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }
      `}</style>
    </ChartCard>
  );
}
