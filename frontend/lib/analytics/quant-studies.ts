import type { SamplePolicy } from "@/lib/quant";
import { EVIDENCE_LABELS } from "@/lib/quant";
import type { AnalyticsDefinition } from "@/lib/analytics/types";
import { getAnalyticsDefinition, getAnalyticsByTier } from "@/lib/analytics/registry";

export type QuantStudyId =
  | "rolling_expectancy"
  | "bootstrap_expectancy"
  | "win_rate_ci"
  | "return_distribution"
  | "outlier_dependency"
  | "top_trade_removal"
  | "monte_carlo"
  | "risk_of_ruin"
  | "loss_streak_distribution"
  | "drawdown_research"
  | "edge_stability"
  | "edge_confidence"
  | "walk_forward";

export type QuantLabTabId = "overview" | "edge" | "drawdown" | "simulation" | "robustness" | "research";

export type QuantStudyMeta = {
  id: QuantStudyId;
  tab: QuantLabTabId;
  assumptions: string[];
  warnings: string[];
};

/** Quant-specific methodology metadata keyed by registry id. */
export const QUANT_STUDY_META: Record<QuantStudyId, QuantStudyMeta> = {
  rolling_expectancy: {
    id: "rolling_expectancy",
    tab: "overview",
    assumptions: ["Closed trades in filter order", "Fixed rolling window in trade count"],
    warnings: ["Short windows react quickly to recent trades", "Not predictive of future expectancy"],
  },
  bootstrap_expectancy: {
    id: "bootstrap_expectancy",
    tab: "edge",
    assumptions: ["Trades are resampled with replacement", "5,000 bootstrap iterations by default", "IID-style resampling — serial correlation not modeled"],
    warnings: ["Bootstrap intervals describe historical resampling uncertainty, not future performance"],
  },
  win_rate_ci: {
    id: "win_rate_ci",
    tab: "edge",
    assumptions: ["Wilson score interval for binomial proportion", "95% confidence level"],
    warnings: ["Wide intervals are normal with small samples"],
  },
  return_distribution: {
    id: "return_distribution",
    tab: "robustness",
    assumptions: ["Uses validated R-multiple or currency returns per trade", "Histogram bins are descriptive"],
    warnings: ["Skewness and kurtosis are sensitive to outliers and sample size"],
  },
  outlier_dependency: {
    id: "outlier_dependency",
    tab: "robustness",
    assumptions: ["Top-trade contribution measured on net profit", "Removal scenarios are counterfactual"],
    warnings: ["High dependency means headline metrics may rely on a few trades"],
  },
  top_trade_removal: {
    id: "top_trade_removal",
    tab: "robustness",
    assumptions: ["Removes top N winners from the filtered sample", "Does not simulate alternate execution"],
    warnings: ["Stress test only — not a forecast"],
  },
  monte_carlo: {
    id: "monte_carlo",
    tab: "simulation",
    assumptions: ["Historical returns resampled with replacement", "Independent trade sequence", "No regime change modeled"],
    warnings: ["Simulated paths are illustrative scenarios, not predictions", "Run only when sample size is adequate"],
  },
  risk_of_ruin: {
    id: "risk_of_ruin",
    tab: "simulation",
    assumptions: ["Fixed % risk per trade on current equity", "Historical R-multiples drive outcomes", "Ruin threshold is a drawdown % from starting equity"],
    warnings: ["Sensitive to risk % and ruin threshold assumptions", "Not a guarantee of future survival"],
  },
  loss_streak_distribution: {
    id: "loss_streak_distribution",
    tab: "drawdown",
    assumptions: ["Streaks computed on sequential closed trades in filter order"],
    warnings: ["Historical frequency does not set a stop-trading rule"],
  },
  drawdown_research: {
    id: "drawdown_research",
    tab: "drawdown",
    assumptions: ["Underwater curve from equity peaks", "R and currency drawdowns may diverge when risk sizing varies"],
    warnings: ["Past maximum drawdown can be exceeded in future samples"],
  },
  edge_stability: {
    id: "edge_stability",
    tab: "edge",
    assumptions: ["Recent window compared with full filtered sample", "Descriptive split only"],
    warnings: ["Recent underperformance may be noise or regime shift — investigate, do not auto-react"],
  },
  edge_confidence: {
    id: "edge_confidence",
    tab: "research",
    assumptions: ["Weighted composite of sample size, stability, drawdown, and outlier dependency"],
    warnings: ["Composite score is a research aid, not a pass/fail grade"],
  },
  walk_forward: {
    id: "walk_forward",
    tab: "research",
    assumptions: ["Chronological train/validation split", "In-sample vs out-of-sample comparison"],
    warnings: ["Single split can be unstable; treat as exploratory validation"],
  },
};

export function getQuantStudy(id: QuantStudyId): AnalyticsDefinition | undefined {
  return getAnalyticsDefinition(id);
}

export function getQuantStudyMeta(id: QuantStudyId): QuantStudyMeta {
  return QUANT_STUDY_META[id];
}

export function getAllQuantStudies(): AnalyticsDefinition[] {
  return getAnalyticsByTier("quant");
}

export function quantEvidenceLabel(sample?: SamplePolicy): string | undefined {
  if (!sample) return undefined;
  return EVIDENCE_LABELS[sample.evidence_level] ?? sample.evidence_level;
}

export function quantSampleWarning(sample?: SamplePolicy, minimum = 20): string | undefined {
  if (!sample) return undefined;
  if (sample.evidence_level === "INSUFFICIENT") {
    return sample.message || `Insufficient sample (${sample.sample_size} trades). Treat conclusions as exploratory only.`;
  }
  if (sample.sample_size < minimum) {
    return `Sample size ${sample.sample_size} is below the recommended ${minimum} trades for stable inference.`;
  }
  return undefined;
}
