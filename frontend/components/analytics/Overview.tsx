"use client";

import { useMemo } from "react";
import { OverviewScorecard } from "@/components/analytics/overview/OverviewScorecard";
import { OverviewEquityHero } from "@/components/analytics/overview/OverviewEquityHero";
import { HowYouWinSection } from "@/components/analytics/overview/HowYouWinSection";
import { OverviewBestTrades } from "@/components/analytics/overview/OverviewBestTrades";
import { YourEdgeSection } from "@/components/analytics/overview/YourEdgeSection";
import { TradeHabitsSection } from "@/components/analytics/overview/TradeHabitsSection";
import { CostSummarySection } from "@/components/analytics/overview/CostSummarySection";
import { ExploreLinksSection } from "@/components/analytics/overview/ExploreLinksSection";
import { InvestigationQueue } from "@/components/analytics/insights/InvestigationQueue";
import { buildInvestigationQueue } from "@/lib/analytics/investigation";
import type { AnalyticsDashboard } from "@/lib/analytics";

type DrillMetric = "win_rate" | "expectancy_r" | "profit_factor" | "average_r";
type TabId = "overview" | "performance" | "edge" | "behaviour" | "execution" | "risk" | "calendar";

export function AnalyticsOverview({
  data,
  onMetricClick,
  onTabChange,
}: {
  data: AnalyticsDashboard;
  onMetricClick?: (metric: DrillMetric) => void;
  onTabChange?: (tab: TabId) => void;
}) {
  const investigations = useMemo(() => buildInvestigationQueue(data), [data]);

  return (
    <div className="overview">
      <OverviewScorecard data={data} onMetricClick={onMetricClick} />
      <OverviewEquityHero data={data} />
      <InvestigationQueue items={investigations} onTabChange={onTabChange} />
      <HowYouWinSection data={data} />
      <OverviewBestTrades data={data} />
      <YourEdgeSection data={data} />
      <TradeHabitsSection data={data} onExploreExecution={() => onTabChange?.("execution")} />
      <CostSummarySection data={data} onViewCosts={() => onTabChange?.("performance")} />
      <ExploreLinksSection onTabChange={onTabChange} />
      <style jsx>{`
        .overview {
          display: grid;
          gap: 4px;
        }
      `}</style>
    </div>
  );
}
