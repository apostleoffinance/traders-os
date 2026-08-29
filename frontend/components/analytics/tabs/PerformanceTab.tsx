"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { QuantLabBridge } from "@/components/analytics/primitives/QuantLabBridge";
import { PerformanceLab } from "@/components/analytics/PerformanceLab";
import { CostAnalytics } from "@/components/analytics/CostAnalytics";
import { ConsistencyLab, PeriodComparisonLab } from "@/components/analytics/Phase2Lab";
import type { AnalyticsDashboard } from "@/lib/analytics";

type DrillMetric = "win_rate" | "expectancy_r" | "profit_factor" | "average_r";

export function PerformanceTab({
  data,
  onMetricClick,
}: {
  data: AnalyticsDashboard;
  onMetricClick?: (metric: DrillMetric) => void;
}) {
  return (
    <>
      <AnalyticsTabIntro page="performance" />
      <PerformanceLab data={data} onMetricClick={onMetricClick} />
      <PeriodComparisonLab data={data} />
      <CostAnalytics data={data} />
      <DeepDiveSection
        title="Consistency review"
        description="Day and week stability metrics — still trader-friendly, not full statistical research."
      >
        <ConsistencyLab data={data} />
      </DeepDiveSection>
      <QuantLabBridge variant="performance" />
    </>
  );
}
