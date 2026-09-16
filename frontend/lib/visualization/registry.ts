import { ANALYTICS_REGISTRY, getAnalyticsDefinition } from "@/lib/analytics/registry";
import type { AnalyticsDefinition } from "@/lib/analytics/types";
import type {
  VisualizationCategory,
  VisualizationComplexity,
  VisualizationDomain,
  VisualizationInteraction,
  VisualizationLibrary,
  VisualizationSpec,
} from "./types";
import { isUplotOwnedSpec } from "./chart-selection";

/**
 * Enrichment for analytics registry entries + decision/market specs.
 * Registry is the source of truth for library ownership and progressive disclosure.
 */
type Enrichment = {
  library: VisualizationLibrary;
  complexity: VisualizationComplexity;
  primary: boolean;
  category?: VisualizationCategory;
  defaultLevel?: 1 | 2 | 3;
  purpose?: string;
  component?: string;
  minSampleSize?: number;
  dataRequirements?: string[];
  interaction?: VisualizationInteraction[];
};

const ENRICHMENT: Record<string, Enrichment> = {
  performance_scorecard: {
    library: "custom",
    complexity: "low",
    primary: true,
    defaultLevel: 1,
    purpose: "Answer am-I-doing-well in one glance",
    component: "OverviewScorecard",
    minSampleSize: 1,
    dataRequirements: ["overview metrics"],
    interaction: ["click-drilldown"],
  },
  equity_curve: {
    library: "uplot",
    complexity: "low",
    primary: true,
    defaultLevel: 2,
    purpose: "Show account equity evolution over time",
    component: "EquityCurve",
    minSampleSize: 2,
    dataRequirements: ["lab.equity.net_pnl.curve"],
    interaction: ["hover", "range-presets", "trade-drilldown"],
  },
  win_loss_breakdown: { library: "echarts", complexity: "low", primary: false, defaultLevel: 2, component: "InteractiveChart" },
  gross_profit_vs_loss: { library: "echarts", complexity: "low", primary: false, component: "InteractiveChart" },
  avg_win_vs_loss: { library: "echarts", complexity: "low", primary: false, component: "InteractiveChart" },
  long_vs_short: { library: "echarts", complexity: "low", primary: false, component: "InteractiveChart" },
  best_worst_trades: { library: "dom", complexity: "low", primary: false, component: "RankList" },
  instrument_performance: {
    library: "dom",
    complexity: "low",
    primary: true,
    defaultLevel: 2,
    purpose: "Rank instruments by expectancy",
    component: "RankList",
    minSampleSize: 5,
    interaction: ["click-drilldown"],
  },
  setup_performance: {
    library: "dom",
    complexity: "low",
    primary: true,
    defaultLevel: 2,
    purpose: "Rank setups by expectancy",
    component: "RankList",
    minSampleSize: 5,
    interaction: ["click-drilldown"],
  },
  session_performance: {
    library: "dom",
    complexity: "low",
    primary: true,
    defaultLevel: 2,
    purpose: "Rank sessions by expectancy",
    component: "RankList",
    minSampleSize: 5,
    interaction: ["click-drilldown"],
  },
  trade_habits: { library: "custom", complexity: "low", primary: false },
  cost_bridge: { library: "echarts", complexity: "low", primary: false, component: "InteractiveChart" },
  r_distribution: { library: "echarts", complexity: "medium", primary: false, defaultLevel: 3, component: "InteractiveChart" },
  rolling_expectancy: {
    library: "uplot",
    complexity: "medium",
    primary: false,
    defaultLevel: 3,
    purpose: "Rolling expectancy stability over trade sequence",
    component: "RollingExpectancy",
    minSampleSize: 20,
    dataRequirements: ["quant rolling expectancy series"],
    interaction: ["hover", "zoom"],
  },
  monte_carlo: { library: "echarts", complexity: "high", primary: false, defaultLevel: 3, component: "InteractiveChart" },
  mfe_mae_scatter: { library: "echarts", complexity: "medium", primary: false, defaultLevel: 3, component: "InteractiveChart" },
  exit_efficiency: { library: "echarts", complexity: "medium", primary: false, defaultLevel: 3, component: "InteractiveChart" },
  period_comparison: { library: "custom", complexity: "low", primary: false },
  consistency_lab: { library: "custom", complexity: "medium", primary: false },
  time_of_day: { library: "echarts", complexity: "low", primary: false, component: "InteractiveChart" },
  time_heatmap: { library: "echarts", complexity: "medium", primary: false, defaultLevel: 3, component: "InteractiveChart" },
  position_size_buckets: { library: "echarts", complexity: "medium", primary: false, component: "InteractiveChart" },
  duration_buckets: { library: "echarts", complexity: "medium", primary: false, component: "InteractiveChart" },
  risk_vs_result: { library: "echarts", complexity: "medium", primary: false, defaultLevel: 3, component: "InteractiveChart" },
  calendar_heatmap: {
    library: "dom",
    complexity: "low",
    primary: true,
    component: "TemporalLab",
    interaction: ["click-drilldown"],
  },
  streak_distribution: { library: "echarts", complexity: "medium", primary: false, component: "InteractiveChart" },
  bootstrap_expectancy: { library: "echarts", complexity: "high", primary: false, component: "InteractiveChart" },
  win_rate_ci: { library: "custom", complexity: "medium", primary: false },
  return_distribution: { library: "echarts", complexity: "high", primary: false, component: "InteractiveChart" },
  outlier_dependency: { library: "custom", complexity: "high", primary: false },
  top_trade_removal: { library: "custom", complexity: "high", primary: false },
  risk_of_ruin: { library: "custom", complexity: "high", primary: false },
  drawdown_research: {
    library: "uplot",
    complexity: "medium",
    primary: false,
    purpose: "Drawdown depth and recovery research",
    component: "UnderwaterCurve",
    minSampleSize: 2,
    dataRequirements: ["lab.equity.drawdown.curve"],
    interaction: ["hover", "range-presets"],
  },
  edge_stability: { library: "custom", complexity: "medium", primary: false },
  edge_confidence: { library: "echarts", complexity: "high", primary: false, component: "InteractiveChart" },
  walk_forward: { library: "echarts", complexity: "high", primary: false, component: "InteractiveChart" },
};

/** Decision / market specs not owned solely by analytics registry. */
const EXTRA_SPECS: VisualizationSpec[] = [
  {
    id: "risk_budget",
    question: "How much danger am I taking right now?",
    title: "Risk budget",
    description: "Daily loss, drawdown, and trade-count utilization against limits.",
    purpose: "L1 risk decision — remaining budget vs policy",
    category: "decision",
    domain: "risk",
    library: "custom",
    complexity: "low",
    primary: true,
    defaultLevel: 1,
    insightEnabled: true,
    pages: ["risk", "overview"],
    component: "RiskBudget",
    dataRequirements: ["risk.personal_daily", "risk.personal_drawdown"],
    interaction: ["none"],
  },
  {
    id: "underwater_equity",
    question: "How deep am I below peak equity?",
    title: "Underwater equity",
    description: "Drawdown depth below the running peak over time.",
    purpose: "Visualize drawdown path under the equity peak",
    category: "essential",
    domain: "risk",
    library: "uplot",
    complexity: "low",
    primary: true,
    defaultLevel: 2,
    insightEnabled: true,
    pages: ["risk"],
    component: "UnderwaterCurve",
    minSampleSize: 2,
    dataRequirements: ["lab.equity.drawdown.curve"],
    interaction: ["hover", "range-presets"],
  },
  {
    id: "investigation_queue",
    question: "What should I investigate next?",
    title: "What's happening",
    description: "Deterministic investigation prompts from analytics signals.",
    purpose: "Route the trader to the next useful tab or drill-down",
    category: "decision",
    domain: "research",
    library: "custom",
    complexity: "low",
    primary: true,
    defaultLevel: 1,
    insightEnabled: true,
    pages: ["overview"],
    component: "InvestigationQueue",
    interaction: ["click-drilldown"],
  },
  {
    id: "market_ohlcv",
    question: "What did price do around my trade?",
    title: "Market chart",
    description: "OHLCV candles, indicators, and trade overlays.",
    purpose: "Market context for trade review (Vela POC)",
    category: "deep_dive",
    domain: "market",
    library: "vela",
    complexity: "high",
    primary: false,
    defaultLevel: 3,
    pages: ["labs"],
    component: "MarketChart",
    dataRequirements: ["OHLCV bars", "trade entry/exit"],
    interaction: ["zoom", "hover"],
  },
    {
    id: "trade_anatomy",
    question: "How did this trade unfold from entry to exit?",
    title: "Trade anatomy",
    description: "Planned vs actual levels with timed MFE/MAE, optional M1 OHLC path, and R scale.",
    purpose: "Single-trade path story without loading a full market chart",
    category: "deep_dive",
    domain: "trade",
    library: "svg",
    complexity: "medium",
    primary: true,
    defaultLevel: 2,
    pages: ["trades"],
    component: "TradeAnatomy",
    dataRequirements: ["trade levels", "optional MFE/MAE", "optional M1 OHLC"],
    interaction: ["hover", "click-drilldown"],
  },
];

function mapTier(tier: AnalyticsDefinition["tier"], override?: VisualizationCategory): VisualizationCategory {
  if (override) return override;
  if (tier === "quant") return "quant";
  if (tier === "deep_dive") return "deep_dive";
  return "essential";
}

function mapDomain(category: AnalyticsDefinition["category"]): VisualizationDomain {
  return category as VisualizationDomain;
}

function fromAnalytics(def: AnalyticsDefinition): VisualizationSpec {
  const enrich = ENRICHMENT[def.id] ?? {
    library: "echarts" as VisualizationLibrary,
    complexity: "medium" as VisualizationComplexity,
    primary: false,
  };
  // Hard guard: equity-family never falls back to ECharts.
  const library = isUplotOwnedSpec(def.id) ? "uplot" : enrich.library;
  return {
    id: def.id,
    question: def.primaryQuestion,
    title: def.title,
    description: def.description,
    purpose: enrich.purpose,
    category: mapTier(def.tier, enrich.category),
    domain: mapDomain(def.category),
    library,
    complexity: enrich.complexity,
    primary: enrich.primary,
    defaultLevel: enrich.defaultLevel,
    insightEnabled: def.insightEnabled,
    pages: def.pages,
    component: enrich.component,
    minSampleSize: enrich.minSampleSize,
    dataRequirements: enrich.dataRequirements,
    interaction: enrich.interaction,
  };
}

/** Deduped visualization registry (analytics first-seen id + extras). */
export function getVisualizationRegistry(): VisualizationSpec[] {
  const seen = new Set<string>();
  const out: VisualizationSpec[] = [];
  for (const def of ANALYTICS_REGISTRY) {
    if (seen.has(def.id)) continue;
    seen.add(def.id);
    out.push(fromAnalytics(def));
  }
  for (const extra of EXTRA_SPECS) {
    if (seen.has(extra.id)) continue;
    seen.add(extra.id);
    out.push(extra);
  }
  return out;
}

export function getVisualizationSpec(id: string): VisualizationSpec | undefined {
  return getVisualizationRegistry().find((s) => s.id === id);
}

export function getVisualizationsByCategory(category: VisualizationCategory): VisualizationSpec[] {
  return getVisualizationRegistry().filter((s) => s.category === category);
}

export function getPrimaryVisualizations(): VisualizationSpec[] {
  return getVisualizationRegistry().filter((s) => s.primary);
}

export function getVisualizationsByLibrary(library: VisualizationLibrary): VisualizationSpec[] {
  return getVisualizationRegistry().filter((s) => s.library === library);
}

export function getOverviewVisualizationIds(): string[] {
  return [
    "performance_scorecard",
    "equity_curve",
    "investigation_queue",
    "instrument_performance",
    "setup_performance",
    "session_performance",
    "risk_budget",
  ];
}

/** Prefer visualization enrichment; fall back to analytics definition title/question. */
export function resolveVizCopy(id: string): { title: string; question: string; description: string } {
  const viz = getVisualizationSpec(id);
  if (viz) return { title: viz.title, question: viz.question, description: viz.description };
  const a = getAnalyticsDefinition(id);
  return {
    title: a?.title ?? id,
    question: a?.primaryQuestion ?? "",
    description: a?.description ?? "",
  };
}
