import type { FilterState } from "@/lib/analytics";
import { buildAnalyticsQuery } from "@/lib/analytics";

export type SamplePolicy = {
  sample_size: number;
  evidence_level: "INSUFFICIENT" | "EXPLORATORY" | "MODERATE" | "STRONGER" | "HIGHER_EVIDENCE";
  message: string;
};

export type DataQuality = {
  total_trades: number;
  valid_quant_trades: number;
  valid_r_trades: number;
  excluded_trades: number;
  exclusions: Record<string, number>;
  flags: Record<string, number>;
  status: string;
};

export type ExpectancyBlock = {
  n: number;
  win_rate: string | null;
  loss_rate: string | null;
  breakeven_rate: string | null;
  wins: number;
  losses: number;
  breakevens: number;
  average_win: string | null;
  average_loss: string | null;
  expectancy_currency: string | null;
  expectancy_r: string | null;
  sample: SamplePolicy;
  category: string;
};

export type WilsonCI = {
  observed: string | null;
  lower_bound: string | null;
  upper_bound: string | null;
  confidence_level: number;
  sample_size: number;
  available: boolean;
  note?: string;
  category?: string;
};

export type BootstrapBlock = {
  point_estimate: string | null;
  bootstrap_mean: string | null;
  median: string | null;
  confidence_interval: { lower: string | null; upper: string | null; level: number };
  histogram?: { from: number; to: number; n: number }[];
  iterations: number;
  available: boolean;
  category: string;
  note?: string;
};

export type QuantLabPayload = {
  meta: {
    filtered_trades: number;
    valid_trades: number;
    date_range: { preset: string; from: string | null; to: string | null } | null;
    account_name: string | null;
    starting_balance: string | null;
  };
  overview: {
    edge_status: {
      observed_expectancy_r: string | null;
      recent_expectancy_r: string | null;
      sample: SamplePolicy;
      max_drawdown_r: string | null;
      max_drawdown_currency: string | null;
      outlier_dependency_pct: string | null;
      outlier_dependency_level: string | null;
      monte_carlo_status: string;
    };
    expectancy_summary: ExpectancyBlock;
    data_quality: DataQuality;
    sample_policy: SamplePolicy;
  };
  edge: {
    expectancy: ExpectancyBlock;
    payoff: {
      payoff_ratio_currency: string | null;
      payoff_ratio_r: string | null;
      note: string | null;
      sample: SamplePolicy;
    };
    win_rate_ci: WilsonCI;
    bootstrap_expectancy_r: BootstrapBlock;
    edge_stability: {
      historical: Record<string, unknown>;
      recent: Record<string, unknown>;
      recent_window: number;
      differences: Record<string, { absolute: string | null; percentage: string | null }>;
      label: string;
      disclaimer: string;
    };
  };
  drawdown: {
    currency: {
      max_drawdown: string | null;
      current_drawdown: string | null;
      underwater_curve: { at: string; equity: string; peak: string; drawdown: string; drawdown_pct: string }[];
    };
    r_multiple: {
      max_drawdown_r: string | null;
      current_drawdown_r: string | null;
      curve: { trade_number: number; at: string | null; cumulative_r: string; drawdown_r: string }[];
    };
    ulcer_index: { ulcer_index: string | null; available: boolean; note?: string };
    ulcer_index_r: { ulcer_index_r: string | null; available: boolean };
    recovery_factor_currency: { recovery_factor: string | null; available: boolean; note?: string };
    recovery_factor_r: { recovery_factor: string | null; available: boolean };
    sample: SamplePolicy;
  };
  rolling: {
    windows: number[];
    default_windows: number[];
    series: Record<string, { trade_number: number; exit_at: string; expectancy_r: string | null; win_rate: string | null }[]>;
    n: number;
  };
  streaks: {
    current: { wins: number; losses: number };
    longest: { wins: number; losses: number };
    loss_streak_distribution: { length: number; label: string; occurrences: number; frequency_pct: string | null }[];
  };
  distribution: DistributionBlock;
  outliers: OutlierBlock;
  robustness: RobustnessBlock;
  simulation: SimulationPreview;
  behavior: BehaviorBlock;
  edge_confidence: EdgeConfidenceBlock;
  walk_forward: WalkForwardBlock;
  research: ResearchBlock;
  disclaimer: string;
};

export type BehaviorSegmentMetrics = {
  n: number;
  win_rate: string | null;
  expectancy_r: string | null;
  profit_factor: string | null;
  average_r: string | null;
  net_pnl?: string;
};

export type DisciplineComparison = {
  label_a: string;
  label_b: string;
  group_a: BehaviorSegmentMetrics;
  group_b: BehaviorSegmentMetrics;
  discipline_alpha_r: string | null;
  label: string;
  disclaimer: string;
};

export type BehaviorBlock = {
  discipline: {
    comparisons: {
      rules_followed_vs_broken: DisciplineComparison;
      non_emotional_vs_emotional: DisciplineComparison;
      with_confirmation_vs_without: DisciplineComparison;
    };
    sample: SamplePolicy;
  };
  risk_escalation: {
    baseline_risk_pct: string | null;
    patterns: {
      key: string;
      label: string;
      average_risk_pct: string | null;
      median_risk_pct: string | null;
      n: number;
      baseline_risk_pct: string | null;
      pct_difference_from_baseline: string | null;
      adequate_sample: boolean;
    }[];
    disclaimer: string;
  };
  position_size: {
    available: boolean;
    reason?: string;
    buckets: {
      label: string;
      n: number;
      expectancy_r: string | null;
      win_rate: string | null;
      emotional_trade_count: number;
      risk_pct_range: { from: string; to: string | null };
    }[];
  };
  setup_interactions: {
    values: { setups: string[]; sessions: string[]; directions: string[]; timeframes: string[]; emotions: string[] };
    min_n_required: number;
    highlighted_combinations: {
      label: string;
      n: number;
      metrics: BehaviorSegmentMetrics | null;
      insufficient_sample: boolean;
    }[];
    multiple_exploration_notice: string;
  };
  mfe_mae: {
    available: boolean;
    status?: string;
    mfe_capture?: { median_pct: string | null; average_pct: string | null; n: number };
    winning_trade_heat?: { median_mae_r: string | null; p75_mae_r: string | null; note?: string };
  };
  disclaimer: string;
};

export type SimulationPreview = {
  status: string;
  default_config: {
    simulations: number;
    future_trades: number;
    unit: string;
    seed: number;
    drawdown_threshold: string;
  };
  allowed_simulations: number[];
  allowed_future_trades: number[];
  historical_sample_size: number;
  can_run: boolean;
};

export type MonteCarloResult = {
  available: boolean;
  reason?: string;
  category: string;
  config?: {
    simulations: number;
    future_trades: number;
    seed: number;
    unit: string;
    drawdown_threshold: string | null;
  };
  assumptions?: string[];
  historical_sample_size?: number;
  ending_return?: {
    median: string;
    mean: string;
    p5: string;
    p95: string;
  };
  max_drawdown?: {
    median: string;
    p75: string;
    p95: string;
  };
  drawdown_at_risk?: {
    p50: string;
    p75: string;
    p90: string;
    p95: string;
    note?: string;
  };
  probabilities?: {
    positive_ending_return: string;
    exceeding_drawdown_threshold: string | null;
  };
  sample_paths?: { ending: string; max_drawdown: string; cumulative: string[] }[];
  disclaimer?: string;
};

export type RiskOfRuinResult = {
  available: boolean;
  reason?: string;
  category: string;
  assumptions?: {
    account_equity: string;
    risk_per_trade_pct: string;
    ruin_drawdown_pct: string;
    simulations: number;
    future_trades: number;
    method: string;
  };
  estimated_probability_pct?: string;
  crossings?: number;
  drawdown_percentiles?: Record<string, string>;
  disclaimer?: string;
};

export type DistributionSeries = {
  n: number;
  unit: string;
  core: {
    mean: string | null;
    median: string | null;
    stdev: string | null;
    min: string | null;
    max: string | null;
    percentiles: Record<string, string | null>;
  };
  advanced: {
    skewness: string | null;
    excess_kurtosis: string | null;
    skewness_interpretation?: { label: string | null; text: string };
    kurtosis_interpretation?: { label: string | null; text: string };
  };
  histogram: { from: number; to: number; n: number }[];
  sample: SamplePolicy;
};

export type DistributionBlock = {
  preferred_unit: string;
  r_multiple: DistributionSeries;
  currency: DistributionSeries;
  primary: DistributionSeries;
  note: string;
};

export type OutlierBlock = {
  total_net_profit: string;
  contributions: Record<string, { amount?: string | null; pct_of_net_profit?: string | null; trade_count?: number }>;
  profit_dependency_top_5_pct: string | null;
  dependency_level: string | null;
  performance_without_outliers: Record<string, {
    n: number;
    net_pnl: string;
    net_r: string | null;
    expectancy_r: string | null;
    profit_factor: string | null;
  }>;
  disclaimer: string;
  sample: SamplePolicy;
};

export type RobustnessBlock = {
  top_trade_removal: {
    scenarios: {
      label: string;
      n: number;
      expectancy_r: string | null;
      profit_factor: string | null;
      net_r: string | null;
      net_pnl: string;
    }[];
    disclaimer: string;
  };
  bootstrap: {
    expectancy_r: BootstrapMetric;
    average_return: BootstrapMetric;
    win_rate: BootstrapMetric;
    iterations: number;
    note: string;
  };
};

export type BootstrapMetric = {
  observed: string | null;
  bootstrap_median: string | null;
  confidence_interval: { lower: string | null; upper: string | null; level: number };
  histogram?: { from: number; to: number; n: number }[];
  available: boolean;
};

export type EdgeConfidenceComponent = {
  score: number;
  weight: number;
  note: string;
};

export type EdgeConfidenceBlock = {
  score: number;
  label: string;
  components: Record<string, EdgeConfidenceComponent>;
  formula: string;
  disclaimer: string;
  category: string;
};

export type WalkForwardMetrics = {
  n: number;
  expectancy_r: string | null;
  win_rate: string | null;
  profit_factor: string | null;
  average_r: string | null;
  max_drawdown_r: string | null;
  net_pnl: string | null;
};

export type WalkForwardBlock = {
  label: string;
  method: string;
  split_ratio: number | null;
  training_period: { from: string | null; to: string | null };
  validation_period: { from: string | null; to: string | null };
  in_sample: WalkForwardMetrics;
  out_of_sample: WalkForwardMetrics;
  differences: Record<string, { absolute: string | null; percentage: string | null }>;
  disclaimer: string;
  category: string;
  sample: SamplePolicy;
};

export type ResearchOpportunity = {
  id: string;
  type: string;
  severity: string;
  title: string;
  prompt: string;
  evidence: Record<string, unknown>;
  sample_size: number;
  cta: { label: string; tab: string };
  priority: number;
  category: string;
};

export type ResearchBlock = {
  opportunities: ResearchOpportunity[];
  count: number;
  multiple_exploration_notice: string;
  disclaimer: string;
};

export function buildQuantQuery(accountId: string, f: FilterState): string {
  return buildAnalyticsQuery(accountId, f);
}

export const EVIDENCE_LABELS: Record<SamplePolicy["evidence_level"], string> = {
  INSUFFICIENT: "Insufficient evidence",
  EXPLORATORY: "Exploratory",
  MODERATE: "Moderate evidence",
  STRONGER: "Stronger evidence",
  HIGHER_EVIDENCE: "Higher evidence",
};
