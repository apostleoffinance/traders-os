"use client";

import { useMemo } from "react";
import { Stat } from "@/components/ui";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useLiveChart } from "@/components/analytics/Charts";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { colorForPnl } from "@/lib/chart-colors";
import { generateCostInsight } from "@/lib/analytics/insights/generators";
import { getAnalyticsDefinition } from "@/lib/analytics/registry";
import { getCostMetrics } from "@/lib/analytics/view-models";
import { money, num } from "@/lib/format";

const WATERFALL_SEGMENTS = ["Gross P&L", "Commission", "Swap", "Net P&L"] as const;

export function CostSummarySection({
  data,
  onViewCosts,
}: {
  data: AnalyticsDashboard;
  onViewCosts?: () => void;
}) {
  const lab = data.lab;
  const currency = data.account.currency;
  const { C } = useLiveChart();
  const gvn = lab?.costs.gross_vs_net;
  const n = gvn?.n ?? 0;
  const costMetrics = useMemo(() => getCostMetrics(data), [data]);
  const insight = useMemo(() => (costMetrics ? generateCostInsight(costMetrics) : null), [costMetrics]);
  const def = getAnalyticsDefinition("cost_bridge");

  if (!lab || !gvn || n === 0) return null;

  const waterfall = {
    tooltip: { trigger: "axis" },
    grid: { left: 48, right: 16, top: 16, bottom: 32 },
    xAxis: { type: "category", data: [...WATERFALL_SEGMENTS] },
    yAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        data: [
          { value: Number(gvn.gross_pnl ?? 0), itemStyle: { color: colorForPnl(C, gvn.gross_pnl) } },
          { value: Number(gvn.commission ?? 0), itemStyle: { color: C.neg } },
          { value: Number(gvn.swap ?? 0), itemStyle: { color: colorForPnl(C, gvn.swap) } },
          { value: Number(gvn.net_pnl ?? 0), itemStyle: { color: colorForPnl(C, gvn.net_pnl) } },
        ],
      },
    ],
  };

  const dragPct = gvn.cost_drag_pct ? `${num(gvn.cost_drag_pct, 1)}%` : null;

  return (
    <section className="section">
      <h2 className="section-title">Cost of trading</h2>
      <p className="section-lead">How commissions and swap affect your gross results.</p>

      <ChartCard
        title={def?.title ?? "Gross to net bridge"}
        question={def?.primaryQuestion}
        tier={def?.tier}
        sampleSize={n}
        evidenceLabel={gvn.evidence.label}
        insight={insight}
      >
        <div className="kpis">
          <Stat label="Gross P&L" value={money(gvn.gross_pnl, currency)} />
          <Stat label="Commission" value={money(gvn.commission, currency)} />
          <Stat label="Swap" value={money(gvn.swap, currency)} />
          <Stat label="Net P&L" value={money(gvn.net_pnl, currency)} />
        </div>
        {dragPct && <p className="drag">Costs reduced gross performance by {dragPct} in this sample.</p>}
        <InteractiveChart option={waterfall} height={200} showHint={false} />
        {onViewCosts ? (
          <button type="button" className="link-btn" onClick={onViewCosts}>
            View full cost analysis →
          </button>
        ) : (
          <p className="muted">Open the Performance tab for detailed commission and swap breakdowns.</p>
        )}
      </ChartCard>

      <style jsx>{`
        .section {
          margin-bottom: 8px;
        }
        .section-title {
          margin: 0 0 4px;
          font-size: 15px;
        }
        .section-lead {
          margin: 0 0 14px;
          font-size: 14px;
          color: var(--text-muted);
        }
        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
          margin-bottom: 10px;
        }
        .drag {
          margin: 0 0 10px;
          font-size: 13px;
          font-weight: 500;
        }
        .link-btn {
          margin-top: 10px;
          border: none;
          background: transparent;
          color: var(--accent);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }
        .muted {
          margin: 10px 0 0;
          font-size: 13px;
          color: var(--text-muted);
        }
      `}</style>
    </section>
  );
}
