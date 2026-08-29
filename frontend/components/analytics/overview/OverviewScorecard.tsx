"use client";

import { useMemo, useState } from "react";
import { Stat } from "@/components/ui";
import { MetricCard } from "@/components/analytics/primitives/MetricCard";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { MiniSparkline } from "@/components/analytics/primitives/MiniSparkline";
import { InsufficientSample } from "@/components/analytics/primitives/InsufficientSample";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { generatePerformanceInsight } from "@/lib/analytics/insights/generators";
import { getAnalyticsDefinition } from "@/lib/analytics/registry";
import { getPerformanceMetrics } from "@/lib/analytics/view-models";
import { money, num, signed, tone } from "@/lib/format";

type DrillMetric = "win_rate" | "expectancy_r" | "profit_factor" | "average_r";

export function OverviewScorecard({
  data,
  onMetricClick,
}: {
  data: AnalyticsDashboard;
  onMetricClick?: (metric: DrillMetric) => void;
}) {
  const o = data.overview;
  const lab = data.lab;
  const n = o.n_trades;
  const currency = data.account.currency;
  const prior = lab?.temporal?.period_comparison;
  const [expanded, setExpanded] = useState(false);

  const kpis = lab?.performance.kpis;
  const wl = lab?.performance.win_loss;

  function periodDelta(metricLabel: string): string | null {
    if (!prior?.available) return null;
    const row = prior.comparison.find((r) => r.metric.toLowerCase().includes(metricLabel));
    return row?.change ? String(row.change) : null;
  }

  const equitySpark = useMemo(() => data.equity.slice(-24).map((p) => Number(p.equity)), [data.equity]);
  const def = getAnalyticsDefinition("performance_scorecard");
  const insight = useMemo(() => generatePerformanceInsight(getPerformanceMetrics(data)), [data]);

  if (n === 0) {
    return (
      <ChartCard
        title={def?.title ?? "Performance scorecard"}
        question={def?.primaryQuestion ?? "Am I making money?"}
        tier={def?.tier}
        sampleSize={0}
        evidenceLabel={o.evidence.label}
      >
        <InsufficientSample n={0} context="performance analytics" />
        <p className="muted">Close trades in this account to see your performance summary here.</p>
        <style jsx>{`.muted { font-size: 13px; margin: 0; }`}</style>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title={def?.title ?? "Performance scorecard"}
      question={def?.primaryQuestion ?? "Am I making money?"}
      tier={def?.tier}
      sampleSize={n}
      evidenceLabel={o.evidence.label}
      insight={insight}
    >
      <div className="primary-kpis">
        <MetricCard
          label="Net P&L"
          value={money(o.net_pnl, currency)}
          tone={tone(o.net_pnl)}
          hint={`${n} trades`}
          spark={<MiniSparkline values={equitySpark} />}
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
          label="Expectancy"
          value={o.expectancy_r ? `${signed(o.expectancy_r)}R` : "—"}
          tone={tone(o.expectancy_r)}
          delta={periodDelta("expectancy")}
          onClick={onMetricClick ? () => onMetricClick("expectancy_r") : undefined}
        />
        <MetricCard label="Total R" value={signed(o.total_r, "R")} tone={tone(o.total_r)} />
        <MetricCard label="Trades" value={String(n)} />
      </div>

      <button type="button" className="expand" onClick={() => setExpanded((v) => !v)}>
        {expanded ? "Hide details" : "Show more metrics"}
      </button>

      {expanded && (
        <div className="secondary-kpis">
          <Stat label="Gross P&L" value={money(kpis?.gross_pnl?.value as string, currency)} tone={tone(kpis?.gross_pnl?.value as string)} />
          <Stat label="Average win" value={money(wl?.average_win, currency)} tone="pos" />
          <Stat label="Average loss" value={money(wl?.average_loss, currency)} tone="neg" />
          <Stat label="Average R" value={o.average_r ? `${num(o.average_r)}R` : "—"} />
          <Stat label="Largest win" value={money(wl?.largest_winner, currency)} tone="pos" />
          <Stat label="Largest loss" value={money(wl?.largest_loser, currency)} tone="neg" />
          <Stat label="Max drawdown" value={money(o.max_drawdown, currency)} tone="neg" />
          <Stat label="Current drawdown" value={money(o.current_drawdown, currency)} />
        </div>
      )}

      {o.sample_note && <p className="note">{o.sample_note}</p>}

      <style jsx>{`
        .primary-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }
        .secondary-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid var(--border);
        }
        .expand {
          margin-top: 12px;
          border: none;
          background: transparent;
          color: var(--accent);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }
        .note {
          margin: 12px 0 0;
          font-size: 13px;
          color: var(--text-muted);
        }
      `}</style>
    </ChartCard>
  );
}
