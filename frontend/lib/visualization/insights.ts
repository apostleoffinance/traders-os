/**
 * Insight layer bridge — quantitative engines stay in lib/analytics;
 * this module is the visualization-facing re-export + helpers.
 */

export {
  generatePerformanceInsight,
  generateEquityInsight,
  generateInstrumentInsight,
  generateSetupInsight,
  generateSessionInsight,
  generateWinLossInsight,
  generateCostInsight,
  generateMfeMaeInsight,
  generateExitEfficiencyInsight,
  generateTimeOfDayInsight,
  generateBucketInsight,
} from "@/lib/analytics/insights/generators";

export type { AnalyticsInsight } from "@/lib/analytics/types";

import type { VisualizationInsight } from "./types";
import type { AnalyticsInsight } from "@/lib/analytics/types";

/** Normalize analytics insights for visualization cards. */
export function toVisualizationInsight(insight: AnalyticsInsight | null | undefined): VisualizationInsight | null {
  if (!insight) return null;
  return {
    summary: insight.summary,
    observation: insight.observation,
    takeaway: insight.takeaway,
    sampleSize: insight.sampleSize,
    direction: insight.direction,
    warning: insight.warning,
  };
}
