"use client";

import { useMemo } from "react";
import { OverviewScorecard } from "@/components/analytics/overview/OverviewScorecard";
import { OverviewEquityHero } from "@/components/analytics/overview/OverviewEquityHero";
import { EdgeSnapshot } from "@/components/visualizations/edge/EdgeSnapshot";
import { InvestigationQueue } from "@/components/trader";
import { buildInvestigationQueue } from "@/lib/analytics/investigation";
import type { AnalyticsDashboard } from "@/lib/analytics";

type DrillMetric = "win_rate" | "expectancy_r" | "profit_factor" | "average_r";
type TabId = "overview" | "performance" | "edge" | "behaviour" | "execution" | "risk" | "calendar";

/**
 * Overview: scorecard + equity + edge ranks first.
 * Optional compact signals after — no explore/decision pedagogy blocks.
 */
export function AnalyticsOverview({
  data,
  onMetricClick,
  onTabChange,
}: {
  data: AnalyticsDashboard;
  onMetricClick?: (metric: DrillMetric) => void;
  onTabChange?: (tab: TabId) => void;
}) {
  const investigations = useMemo(() => buildInvestigationQueue(data).slice(0, 3), [data]);

  return (
    <div className="overview">
      <OverviewScorecard data={data} onMetricClick={onMetricClick} />
      <OverviewEquityHero data={data} />
      <EdgeSnapshot data={data} />
      {investigations.length > 0 ? (
        <InvestigationQueue items={investigations} onTabChange={onTabChange} />
      ) : null}
      <style jsx>{`
        .overview {
          display: grid;
          gap: 10px;
        }
      `}</style>
    </div>
  );
}
