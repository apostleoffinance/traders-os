"use client";

import { OverviewDecisionStrip, InvestigationQueue } from "@/components/trader";
import { useMemo } from "react";
import { OverviewScorecard } from "@/components/analytics/overview/OverviewScorecard";
import { OverviewEquityHero } from "@/components/analytics/overview/OverviewEquityHero";
import { ExploreLinksSection } from "@/components/analytics/overview/ExploreLinksSection";
import { EdgeSnapshot } from "@/components/visualizations/edge/EdgeSnapshot";
import { buildInvestigationQueue } from "@/lib/analytics/investigation";
import type { AnalyticsDashboard } from "@/lib/analytics";

type DrillMetric = "win_rate" | "expectancy_r" | "profit_factor" | "average_r";
type TabId = "overview" | "performance" | "edge" | "behaviour" | "execution" | "risk" | "calendar";

/**
 * Overview answers in ~10 seconds:
 * Am I doing well? What's working? What's hurting? What should I investigate?
 * Dense charts live in Performance / Edge / Execution / Quant — not here.
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
  const investigations = useMemo(() => buildInvestigationQueue(data), [data]);

  return (
    <div className="overview">
      <OverviewScorecard data={data} onMetricClick={onMetricClick} />
      <OverviewEquityHero data={data} />
      <section className="happening">
        <h2 className="section-title">What&apos;s happening</h2>
        <p className="section-lead">Deterministic signals from your sample — investigate before you change your process.</p>
        <InvestigationQueue items={investigations} onTabChange={onTabChange} />
      </section>
      <EdgeSnapshot data={data} />
      <OverviewDecisionStrip data={data} onTabChange={onTabChange} />
      <ExploreLinksSection onTabChange={onTabChange} />
      <style jsx>{`
        .overview {
          display: grid;
          gap: 8px;
        }
        .happening {
          margin-top: 4px;
        }
        .section-title {
          margin: 0 0 4px;
          font-size: 15px;
        }
        .section-lead {
          margin: 0 0 12px;
          font-size: 14px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
