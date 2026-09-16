/**
 * Chart selection rules — pick a library by job, not by habit.
 * Source of truth for *which* engine; `registry.ts` owns per-viz metadata.
 */

import type { VisualizationLibrary } from "./types";

/** Product jobs that map to a preferred rendering engine. */
export type ChartJob =
  | "time_series"
  | "statistical"
  | "market_ohlc"
  | "simple_metric"
  | "ranking"
  | "risk_allocation"
  | "simple_comparison"
  | "custom_visual";

export type ChartSelectionRule = {
  job: ChartJob;
  library: VisualizationLibrary;
  /** Human rationale — keep short; used in docs / tooling. */
  rationale: string;
  /** Preferred owned components when they exist. */
  components?: string[];
};

/**
 * Canonical selection table.
 * Do not introduce a new chart library for every chart.
 */
export const CHART_SELECTION_RULES: readonly ChartSelectionRule[] = [
  {
    job: "time_series",
    library: "uplot",
    rationale: "Dense equity / drawdown / rolling series — uPlot is fast and themeable.",
    components: ["EquityCurve", "UnderwaterCurve", "RollingExpectancy"],
  },
  {
    job: "statistical",
    library: "echarts",
    rationale: "Histograms, heatmaps, scatters, Monte Carlo — ECharts (lazy via InteractiveChart).",
    components: ["InteractiveChart"],
  },
  {
    job: "market_ohlc",
    library: "vela",
    rationale: "Candles, indicators, drawings — Vela only (isolated POC / market surfaces).",
    components: ["MarketChart", "VelaChart"],
  },
  {
    job: "simple_metric",
    library: "dom",
    rationale: "Single KPI answers — MetricCard / Stat, not a chart library.",
    components: ["MetricCard", "Stat"],
  },
  {
    job: "ranking",
    library: "dom",
    rationale: "Top-N expectancy / win-rate ranks — RankList (DOM).",
    components: ["RankList", "EdgeSnapshot"],
  },
  {
    job: "risk_allocation",
    library: "dom",
    rationale: "Limit utilization / remaining risk — progress bars and budget panels.",
    components: ["RiskBudget", "LimitBar"],
  },
  {
    job: "simple_comparison",
    library: "dom",
    rationale: "Few categories — DOM bars or compact tables before ECharts.",
    components: ["HorizontalBars"],
  },
  {
    job: "custom_visual",
    library: "svg",
    rationale: "Bespoke product visuals — SVG/DOM first; visx only if stock engines fail.",
    components: ["TradeAnatomy"],
  },
] as const;

const BY_JOB: Record<ChartJob, ChartSelectionRule> = Object.fromEntries(
  CHART_SELECTION_RULES.map((r) => [r.job, r]),
) as Record<ChartJob, ChartSelectionRule>;

/** Resolve the preferred library for a chart job. */
export function selectChartLibrary(job: ChartJob): VisualizationLibrary {
  return BY_JOB[job].library;
}

export function getChartSelectionRule(job: ChartJob): ChartSelectionRule {
  return BY_JOB[job];
}

/**
 * Jobs that must never use ECharts (equity / underwater live here).
 * Phase 3: ECharts equity/underwater path is removed.
 */
export const UPLOT_ONLY_JOBS: readonly ChartJob[] = ["time_series"] as const;

/** Specs that are owned by uPlot wrappers — do not reintroduce ECharts for these ids. */
export const UPLOT_OWNED_SPEC_IDS = [
  "equity_curve",
  "underwater_equity",
  "drawdown_research",
  "rolling_expectancy",
] as const;

export type UplotOwnedSpecId = (typeof UPLOT_OWNED_SPEC_IDS)[number];

export function isUplotOwnedSpec(id: string): id is UplotOwnedSpecId {
  return (UPLOT_OWNED_SPEC_IDS as readonly string[]).includes(id);
}

/**
 * Prefer explicit registry library when provided; otherwise job / uPlot-owned id rules.
 * Call sites should still render owned components (EquityCurve, etc.), not raw engines.
 */
export function resolveChartLibrary(opts: {
  specId?: string;
  job?: ChartJob;
  /** Pass `getVisualizationSpec(id)?.library` when available — avoids circular imports. */
  registryLibrary?: VisualizationLibrary;
}): VisualizationLibrary | undefined {
  if (opts.registryLibrary) {
    if (opts.specId && isUplotOwnedSpec(opts.specId)) return "uplot";
    return opts.registryLibrary;
  }
  if (opts.specId && isUplotOwnedSpec(opts.specId)) return "uplot";
  if (opts.job) return selectChartLibrary(opts.job);
  return undefined;
}

/** Guard for tooling / tests — equity-family specs must stay on uPlot. */
export function assertTimeSeriesLibrary(library: VisualizationLibrary, context: string): void {
  if (library !== "uplot") {
    throw new Error(
      `Time-series charts must use uPlot (${context} requested "${library}"). See chart-selection.ts.`,
    );
  }
}
