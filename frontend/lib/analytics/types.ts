import type { Evidence } from "@/lib/analytics";

export type AnalyticsTier = "essential" | "deep_dive" | "quant";

export type AnalyticsCategory =
  | "performance"
  | "edge"
  | "execution"
  | "behaviour"
  | "risk"
  | "calendar"
  | "costs"
  | "research";

export type AnalyticsChartType =
  | "line"
  | "area"
  | "bar"
  | "horizontal_bar"
  | "stacked_bar"
  | "scatter"
  | "heatmap"
  | "histogram"
  | "pie"
  | "table"
  | "metric";

export type AnalyticsPageId =
  | "overview"
  | "performance"
  | "edge"
  | "behaviour"
  | "execution"
  | "risk"
  | "calendar"
  | "quant_lab"
  | "reports";

export type InsightStrength = "insufficient" | "early" | "moderate" | "strong";

export type InsightDirection = "positive" | "negative" | "neutral" | "mixed";

export interface AnalyticsInsight {
  /** What the chart shows — one sentence */
  summary: string;
  /** Most important observation */
  observation: string;
  /** Optional action the trader may consider */
  takeaway?: string;
  sampleSize?: number;
  strength?: InsightStrength;
  direction?: InsightDirection;
  warning?: string;
  methodology?: string;
  evidence?: Evidence;
}

export interface AnalyticsDefinition {
  id: string;
  title: string;
  category: AnalyticsCategory;
  tier: AnalyticsTier;
  description: string;
  primaryQuestion: string;
  traderValue: string;
  minimumSampleSize?: number;
  chartType: AnalyticsChartType;
  insightEnabled: boolean;
  drilldownEnabled?: boolean;
  requiredData?: string[];
  emptyState?: string;
  methodology?: string;
  pages: AnalyticsPageId[];
}
