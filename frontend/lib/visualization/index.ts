export type {
  VisualizationLibrary,
  VisualizationCategory,
  VisualizationComplexity,
  VisualizationDomain,
  VisualizationSpec,
  VisualizationInsight,
  VisualizationInteraction,
  EquityRangePreset,
} from "./types";

export {
  vizPalette,
  colorForPnl,
  colorForDirection,
  colorForBinRange,
  colorForResult,
  areaColor,
  withAlpha,
} from "./colors";
export type { ChartPalette } from "./colors";

export {
  formatAxisMoney,
  formatAxisNumber,
  formatR,
  formatPct,
  formatSampleSize,
  formatDateShort,
  formatDelta,
} from "./formatters";

export {
  equityTooltipLine,
  drawdownTooltipLine,
  rankingTooltipLine,
  lookForHint,
} from "./tooltips";

export {
  breakpointFromWidth,
  chartHeight,
  simplifyAxes,
  overviewRankLimit,
} from "./responsive";
export type { Breakpoint } from "./responsive";

export { SAMPLE, EXPECTANCY, PROFIT_FACTOR, DRAWDOWN, expectancyTone } from "./thresholds";

export {
  toVisualizationInsight,
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
} from "./insights";

export {
  getVisualizationRegistry,
  getVisualizationSpec,
  getVisualizationsByCategory,
  getPrimaryVisualizations,
  getVisualizationsByLibrary,
  getOverviewVisualizationIds,
  resolveVizCopy,
} from "./registry";

export {
  CHART_SELECTION_RULES,
  UPLOT_ONLY_JOBS,
  UPLOT_OWNED_SPEC_IDS,
  selectChartLibrary,
  getChartSelectionRule,
  isUplotOwnedSpec,
  resolveChartLibrary,
  assertTimeSeriesLibrary,
} from "./chart-selection";
export type { ChartJob, ChartSelectionRule, UplotOwnedSpecId } from "./chart-selection";
