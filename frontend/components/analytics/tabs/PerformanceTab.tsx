"use client";

import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { QuantLabBridge } from "@/components/analytics/primitives/QuantLabBridge";
import { PerformanceLab, ProfitFactorExplorer } from "@/components/analytics/PerformanceLab";
import { PerformanceEquitySection } from "@/components/analytics/performance/PerformanceEquitySection";
import { PerformanceMonthlySection } from "@/components/analytics/performance/PerformanceMonthlySection";
import { CostAnalytics } from "@/components/analytics/CostAnalytics";
import { ConsistencyLab, PeriodComparisonLab } from "@/components/analytics/Phase2Lab";
import type { AnalyticsDashboard } from "@/lib/analytics";

type DrillMetric = "win_rate" | "expectancy_r" | "profit_factor" | "average_r";

/** Performance: scorecard → equity → monthly → supporting detail (no accordion). */
export function PerformanceTab({
  data,
  onMetricClick,
}: {
  data: AnalyticsDashboard;
  onMetricClick?: (metric: DrillMetric) => void;
}) {
  const wl = data.lab?.performance.win_loss;
  const currency = data.account.currency;

  return (
    <>
      <DisclosureLayer kind="decision">
        <PerformanceLab data={data} onMetricClick={onMetricClick} variant="essential" />
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <PerformanceEquitySection data={data} />
        <PerformanceMonthlySection data={data} />
        <PeriodComparisonLab data={data} />
        <CostAnalytics data={data} />
        {wl && data.lab && data.overview.n_trades > 0 ? (
          <ProfitFactorExplorer data={data} wl={wl} currency={currency} onMetricClick={onMetricClick} />
        ) : null}
        <ConsistencyLab data={data} />
        <QuantLabBridge variant="performance" />
      </DisclosureLayer>
    </>
  );
}
