/**
 * TraderOS visualization architecture types.
 * Extends analytics registry concepts without replacing metric computation.
 */

export type VisualizationLibrary = "uplot" | "echarts" | "visx" | "vela" | "custom" | "svg" | "dom";

/** Product disclosure category — where the viz should live by default. */
export type VisualizationCategory = "essential" | "deep_dive" | "quant" | "decision";

export type VisualizationComplexity = "low" | "medium" | "high";

export type VisualizationDomain =
  | "performance"
  | "edge"
  | "risk"
  | "behaviour"
  | "execution"
  | "trade"
  | "quant"
  | "market"
  | "calendar"
  | "costs"
  | "research";

export type EquityRangePreset = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "ALL";

export type VisualizationInteraction =
  | "none"
  | "hover"
  | "click-drilldown"
  | "zoom"
  | "brush"
  | "range-presets"
  | "trade-drilldown";

export type VisualizationSpec = {
  /** Stable id — usually matches analytics registry id when one exists. */
  id: string;
  /** Trader-facing question this visualization answers. */
  question: string;
  title: string;
  description: string;
  /** Short product purpose (why this viz exists). */
  purpose?: string;
  category: VisualizationCategory;
  domain: VisualizationDomain;
  library: VisualizationLibrary;
  complexity: VisualizationComplexity;
  /** Shown by default on Overview / primary surfaces. */
  primary: boolean;
  /** Prefer progressive disclosure levels 1–3. */
  defaultLevel?: 1 | 2 | 3;
  insightEnabled?: boolean;
  pages?: string[];
  /** Owned presentational component (e.g. EquityCurve) — avoid raw library usage. */
  component?: string;
  /** Minimum closed trades / points before the viz is reliable. */
  minSampleSize?: number;
  /** Human-readable data needs for builders / empty states. */
  dataRequirements?: string[];
  /** Supported interactions (pipe-joined in docs; array in code). */
  interaction?: VisualizationInteraction[];
};

export type VisualizationInsight = {
  summary: string;
  observation: string;
  takeaway?: string;
  sampleSize?: number;
  direction?: "positive" | "negative" | "neutral" | "mixed";
  warning?: string;
};
