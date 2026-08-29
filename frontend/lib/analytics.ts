import { chartTheme as liveChartTheme } from "@/lib/theme";

export { chartTheme } from "@/lib/theme";

export type Evidence = {
  n: number;
  level: "INSUFFICIENT" | "LOW" | "MODERATE" | "HIGH";
  label: string;
  reason: string;
};

export type GroupRow = {
  key: string;
  n: number;
  net_pnl: string;
  expectancy_r: string | null;
  win_rate: string | null;
  average_r: string | null;
  profit_factor: string | null;
  insight: string | null;
  evidence: Evidence;
  trading_days?: number;
  label?: string;
  month?: string;
};

export type EquityMarker = {
  trade_id: string;
  at: string;
  symbol: string;
  direction: string;
  result: string;
  net_pnl: string;
  r_multiple: string | null;
};

export type EquityPt = {
  at: string;
  equity: string;
  peak: string;
  drawdown: string;
  drawdown_pct: string;
  daily_pnl: string;
  cumulative_r: string;
};

export type AnalyticsDashboard = {
  account: { id: string; name: string; currency: string; firm: string };
  filters: {
    preset: string;
    date_from: string | null;
    date_to: string | null;
    symbol: string | null;
    session: string | null;
    setup_id: string | null;
    direction: string | null;
    timeframe: string | null;
    psychology: string | null;
    result: string | null;
    options: {
      symbols: string[];
      sessions: string[];
      setups: { id: string; name: string }[];
      timeframes: string[];
      psychology: string[];
    };
  };
  overview: {
    n_trades: number;
    net_pnl: string;
    expectancy_r: string | null;
    win_rate: string | null;
    profit_factor: string | null;
    average_r: string | null;
    max_drawdown: string;
    current_drawdown: string;
    average_risk: string | null;
    discipline_score: number | null;
    total_r: string;
    sample_note: string | null;
    evidence: Evidence;
  };
  equity: EquityPt[];
  drawdown: {
    current: string;
    current_pct: string;
    max: string;
    max_pct: string;
    peak: string;
    equity: string;
    episodes: { start: string; end: string | null; duration_days: number; depth: string; recovered: boolean }[];
    open: { start: string; duration_days: number; depth: string } | null;
    worst: { depth: string; duration_days: number; start: string } | null;
    n_episodes: number;
  };
  sessions: GroupRow[];
  setups: GroupRow[];
  psychology: GroupRow[];
  weekday: GroupRow[];
  r_distribution: {
    n: number;
    mean: string | null;
    median: string | null;
    min: string | null;
    max: string | null;
    stdev: string | null;
    bins: { from: number; to: number; n: number }[];
    evidence: Evidence;
  };
  frequency: GroupRow[];
  risk_vs_result: {
    id: string;
    at: string;
    symbol: string;
    session: string;
    setup: string;
    risk_percent: string;
    risk_amount: string;
    realized_r: string;
    realized_pnl: string;
    result: string;
  }[];
  holding_vs_result: {
    id: string;
    at: string;
    setup: string;
    session: string;
    holding_seconds: number;
    realized_r: string;
    result: string;
  }[];
  calendar: { date: string; n: number; net_pnl: string; r: string | null; win_rate: string | null }[];
  streaks: {
    current_losses: number;
    current_wins: number;
    longest_losses: number;
    longest_wins: number;
    loss_distribution: { length: number; occurrences: number }[];
    win_distribution: { length: number; occurrences: number }[];
    evidence: Evidence;
  };
  consistency: {
    trading_days: number;
    profitable_days: number;
    profitable_day_pct: string | null;
    average_daily_r: string | null;
    median_daily_r: string | null;
    stdev_daily_r: string | null;
    best_day: { date: string; r: string | null; n: number } | null;
    worst_day: { date: string; r: string | null; n: number } | null;
    profitable_weeks: number;
    losing_weeks: number;
    weeks: number;
    evidence: Evidence;
  };
  monthly: GroupRow[];
  rolling_expectancy: { at: string; n: number; expectancy_r: string; window: number }[];
  after_losses: GroupRow & { threshold: number };
  risk: {
    status: string;
    reasons: string[];
    personal_daily: { used: string; limit: string; pct: string | null };
    personal_drawdown: { used: string; limit: string; pct: string | null };
    firm_daily: { used: string; limit: string; pct: string | null };
    firm_drawdown: { used: string; limit: string; pct: string | null };
    trades_today: number;
    max_trades_per_day: number;
    avg_risk_last_n: string | null;
    risk_escalation_pct: string | null;
  };
  observations: {
    title: string;
    text: string;
    metric: string;
    sample_size: number;
    evidence: Evidence;
  }[];
  edge_matrix: EdgeMatrix;
  edge_combos: EdgeCombo[];
  lab?: AnalyticsLab;
};

export type LabKpi = {
  value: string | number | null;
  unit: string;
  n: number;
  note?: string | null;
};

export type LabBucketRow = {
  bucket: string;
  n: number;
  net_pnl: string | null;
  gross_pnl?: string | null;
  net_r?: string | null;
  win_rate: string | null;
  average_r?: string | null;
  expectancy_r?: string | null;
  expectancy_currency?: string | null;
  profit_factor?: string | null;
  average_holding_seconds?: number | null;
  average_risk?: string | null;
  evidence: Evidence;
  sample_note?: string | null;
  sample_label?: string;
};

export type LabLeaderboardRow = {
  key: string;
  label: string;
  n: number;
  net_pnl: string | null;
  gross_pnl?: string | null;
  net_r?: string | null;
  win_rate: string | null;
  average_r?: string | null;
  expectancy_r?: string | null;
  expectancy_currency?: string | null;
  profit_factor?: string | null;
  average_holding_seconds?: number | null;
  average_risk?: string | null;
  evidence: Evidence;
  sample_note?: string | null;
  sample_label?: string;
};

export type LabTradeRank = {
  rank: number;
  trade_id: string;
  symbol: string;
  direction: string;
  setup: string;
  entry_at: string;
  exit_at: string | null;
  net_pnl: string;
  gross_pnl?: string;
  r_multiple: string | null;
  holding_time_seconds: number | null;
  lot_size: string;
  commission: string;
  swap: string;
};

export type AnalyticsLab = {
  metadata: {
    sample_size: number;
    period: string;
    timezone: string;
    filters: Record<string, string | null>;
    evidence: Evidence;
    definitions: Record<string, string>;
  };
  performance: {
    kpis: Record<string, LabKpi>;
    win_loss: {
      n: number;
      win_rate: string | null;
      loss_rate: string | null;
      breakeven_rate: string | null;
      wins: number;
      losses: number;
      breakevens: number;
      average_win: string | null;
      average_loss: string | null;
      median_win: string | null;
      median_loss: string | null;
      largest_winner: string | null;
      largest_loser: string | null;
      win_loss_ratio: string | null;
      profit_factor: {
        value: string | null;
        gross_profit: string;
        gross_loss: string;
        note: string | null;
        n: number;
      };
      composition: { label: string; n: number; pct: number }[];
      evidence: Evidence;
      sample_note: string | null;
    };
    direction_comparison: {
      long: Record<string, unknown>;
      short: Record<string, unknown>;
      metrics: string[];
    };
    best_trades: {
      winners: LabTradeRank[];
      losers: LabTradeRank[];
      best_winner: LabTradeRank | null;
      worst_loser: LabTradeRank | null;
    };
    sample_note: string | null;
    evidence: Evidence;
  };
  edge: {
    instruments: LabLeaderboardRow[];
    setups: LabLeaderboardRow[];
    sessions: LabLeaderboardRow[];
    time_of_day: {
      timezone: string;
      by_hour: (LabBucketRow & { hour: number })[];
      heatmap: (LabBucketRow & { day: string; hour: number })[];
      metric: string;
    };
  };
  execution: {
    position_size: {
      buckets: LabBucketRow[];
      method: string;
      disclaimer: string;
      sample_note: string | null;
    };
    duration: { buckets: LabBucketRow[]; sample_note: string | null };
    mfe_mae: {
      available: boolean;
      reason?: string;
      coverage_n?: number;
      coverage_pct?: string | null;
      precision?: string;
      source?: string;
      disclaimer?: string;
      average_mfe_r?: string | null;
      average_mae_r?: string | null;
      median_mfe_r?: string | null;
      median_mae_r?: string | null;
      scatter?: {
        trade_id: string;
        symbol: string;
        mfe_r: string | null;
        mae_r: string | null;
        realized_r: string | null;
        result: string;
      }[];
      evidence: Evidence;
      sample_note?: string | null;
    };
    exit_efficiency: {
      available: boolean;
      reason?: string;
      coverage_n?: number;
      average_capture?: string | null;
      median_capture?: string | null;
      median_capture_pct?: string | null;
      average_giveback_r?: string | null;
      insight?: string | null;
      disclaimer?: string;
      scatter?: {
        trade_id: string;
        symbol: string;
        mfe_r: string | null;
        realized_r: string | null;
        capture_ratio: string | null;
      }[];
      evidence: Evidence;
      sample_note?: string | null;
    };
    sample_note: string | null;
    evidence: Evidence;
  };
  costs: {
    commissions: {
      total: string | null;
      average: string | null;
      median: string | null;
      by_instrument: { symbol: string; total: string }[];
      pct_of_gross_profit: string | null;
      data_available: boolean;
      missing_note: string | null;
      n: number;
      evidence: Evidence;
    };
    swaps: {
      total: string | null;
      average: string | null;
      positive: string | null;
      negative: string | null;
      by_instrument: { symbol: string; total: string }[];
      data_available: boolean;
      missing_note: string | null;
      n: number;
      evidence: Evidence;
    };
    gross_vs_net: {
      gross_pnl: string | null;
      commission: string | null;
      swap: string | null;
      total_trading_cost: string | null;
      net_pnl: string | null;
      cost_drag_pct: string | null;
      cost_drag_note: string | null;
      sign_convention: string;
      n: number;
      sample_note: string | null;
      evidence: Evidence;
    };
  };
  distributions?: {
    trade_pnl: DistributionBlock & { histogram: HistBin[] };
    r_multiple: DistributionBlock & { bins: HistBin[] };
    daily_pnl: DistributionBlock & { trading_days: number; profitable_days: number; losing_days: number; flat_days: number; histogram: HistBin[] };
    daily_r_buckets: { buckets: { label: string; n: number }[]; trading_days_with_r: number; evidence: Evidence; sample_note: string | null };
    expectancy: {
      n: number;
      win_rate: string | null;
      loss_rate: string | null;
      breakevens: number;
      expectancy_currency: string | null;
      expectancy_r: string | null;
      average_r: string | null;
      median_r: string | null;
      total_r: string | null;
      valid_r_observations: number;
      missing_r: number;
      evidence: Evidence;
      sample_note: string | null;
    };
  };
  consistency?: {
    winning_days_pct: string | null;
    winning_weeks_pct: string | null;
    positive_months_pct: string | null;
    trading_days: number;
    profitable_days: number;
    losing_days: number;
    flat_days: number;
    average_daily_pnl: string | null;
    median_daily_pnl: string | null;
    daily_pnl_volatility: string | null;
    largest_winning_day: string | null;
    largest_losing_day: string | null;
    evidence: Evidence;
    sample_note: string | null;
  };
  equity?: {
    modes: string[];
    markers: EquityMarker[];
    net_pnl: { curve: EquityPt[]; n: number };
    gross_pnl: { curve: EquityPt[]; n: number };
    drawdown: {
      max_drawdown: string | null;
      max_drawdown_pct: string | null;
      current_drawdown: string | null;
      curve: { at: string; drawdown: string; drawdown_pct: string; equity: string; peak: string }[];
      episodes: { episodes: { start: string; end: string | null; duration_days: number; depth: string; recovered: boolean }[]; n_episodes: number };
      recovery_table: { drawdown: number; start: string; recovery: string; depth: string; duration_days: number }[];
    };
    evidence: Evidence;
    sample_note: string | null;
  };
  streaks?: {
    current: { wins: number; losses: number };
    longest: { wins: number; losses: number };
    averages: { average_win_streak: string | null; average_loss_streak: string | null };
    loss_distribution: { length: number; occurrences: number }[];
    after_streaks: GroupRow[];
    breakeven_rule: string;
    n: number;
    evidence: Evidence;
    sample_note: string | null;
  };
  risk_analytics?: {
    distribution: { risk_amount: DistributionBlock; risk_percent: DistributionBlock & { buckets: { label: string; n: number }[] }; missing_risk: number };
    consistency: { configured_risk: string | null; average_actual_risk: string | null; deviation_pct: string | null; valid_observations: number };
    risk_vs_outcome: { bucket: string; n: number; win_rate: string | null; average_r: string | null; net_pnl: string | null }[];
    escalation: { context: string; average_risk: string; pct_difference: string; wording: string }[];
    evidence: Evidence;
  };
  temporal?: {
    calendar: { days: { date: string; n: number; net_pnl: string; gross_pnl: string; r: string | null; wins: number; losses: number; record: string }[]; timezone: string; evidence: Evidence };
    weekday: GroupRow[];
    week_of_month: { key: string; n: number; net_pnl: string | null; win_rate: string | null }[];
    monthly: { rows: { month: string; n: number; win_rate: string | null; net_pnl: string; profit_factor: string | null }[]; summary: Record<string, unknown> };
    period_comparison: { available: boolean; comparison: { metric: string; current: string | number | null; previous: string | number | null; change: string | null }[]; disclaimer: string };
  };
  intelligence?: IntelligenceLabPayload;
};

export type IntelligenceInsightCard = {
  id: string;
  category: string;
  severity: string;
  confidence: string;
  title: string;
  finding: string;
  evidence: Record<string, unknown>;
  sample_size: number;
  priority: number;
};

export type IntelligenceLabPayload = {
  metadata: {
    sample_size: number;
    trades_analyzed: number;
    confidence: { sample_size: number; confidence_level: string; message: string };
    philosophy: string;
  };
  behaviour: {
    revenge_trading: {
      baseline_risk: string | null;
      average_risk_after_loss: string | null;
      average_risk_after_win: string | null;
      risk_multiplier_after_loss_pct: string | null;
      disclaimer: string;
    };
    loss_streak_behaviour: { states: { state: string; n: number; win_rate: string | null; average_r: string | null; avg_risk: string | null }[] };
    overtrading: { normal_trades_per_day: string | null; max_trades_in_day: number; status: string };
  };
  psychology: Record<string, unknown>;
  discipline: Record<string, unknown>;
  playbooks: { playbooks: { name: string; trade_count: number; expectancy_r: string | null; win_rate: string | null; edge_quality: { score: string; components: Record<string, number> }; drift: Record<string, { status: string }>; confidence: { message: string } }[] };
  edge_maps: { edge_map: { setup: string; symbol: string; session: string; n: number; expectancy_r: string | null; edge_quality: { score: string } }[]; weakness_map: { setup: string; symbol: string; session: string; n: number; expectancy_r: string | null }[] };
  decision_quality: {
    counts: { good_win: number; good_loss: number; lucky_win: number; bad_loss: number };
    labels: Record<string, string>;
    methodology: string;
    sample_size: number;
  };
  improvement: Record<string, unknown>;
  comparisons: Record<string, unknown>;
  statistics: Record<string, unknown>;
  insights: IntelligenceInsightCard[];
  segments: Record<string, unknown>;
};

export type DistributionBlock = {
  n: number;
  mean: string | null;
  median: string | null;
  stdev: string | null;
  min: string | null;
  max: string | null;
  percentiles?: Record<string, string | null>;
  evidence: Evidence;
  sample_note: string | null;
};

export type HistBin = { from: number; to: number; n: number };

export type EdgeCell = {
  symbol: string;
  session: string;
  tone: "positive" | "negative" | "mixed" | "neutral";
  n: number;
  expectancy_r: string | null;
  win_rate: string | null;
  profit_factor: string | null;
  average_r: string | null;
  discipline_avg: number | null;
  net_pnl: string | null;
  evidence: Evidence;
};

export type EdgeMatrix = {
  symbols: string[];
  sessions: string[];
  cells: EdgeCell[];
  evidence: Evidence;
};

export type EdgeCombo = {
  symbol: string;
  session: string;
  setup: string;
  label: string;
  n: number;
  expectancy_r: string | null;
  win_rate: string | null;
  evidence: Evidence;
};

export type EdgeDetail = {
  symbol: string;
  session: string;
  setup: string | null;
  direction: string | null;
  label: string;
  top_setup: string | null;
  avg_holding_seconds: number | null;
  edge: EdgeCell;
  rest: EdgeCell;
  filters: { preset: string };
};

export type FilterState = {
  preset: string;
  date_from: string;
  date_to: string;
  symbol: string;
  session: string;
  setup_id: string;
  direction: string;
  timeframe: string;
  psychology: string;
  result: string;
  hour: string;
};

export const EMPTY_FILTERS: FilterState = {
  preset: "all",
  date_from: "",
  date_to: "",
  symbol: "",
  session: "",
  setup_id: "",
  direction: "",
  timeframe: "",
  psychology: "",
  result: "",
  hour: "",
};

export function buildAnalyticsQuery(accountId: string, f: FilterState): string {
  const p = new URLSearchParams({ account_id: accountId, preset: f.preset });
  if (f.preset === "custom") {
    if (f.date_from) p.set("date_from", f.date_from);
    if (f.date_to) p.set("date_to", f.date_to);
  }
  if (f.symbol) p.set("symbol", f.symbol);
  if (f.session) p.set("session", f.session);
  if (f.setup_id) p.set("setup_id", f.setup_id);
  if (f.direction) p.set("direction", f.direction);
  if (f.timeframe) p.set("timeframe", f.timeframe);
  if (f.psychology) p.set("psychology", f.psychology);
  if (f.result) p.set("result", f.result);
  if (f.hour) p.set("hour", f.hour);
  return p.toString();
}

/** Map shell global period to analytics API preset. */
export function globalPeriodToPreset(period: string): string {
  const map: Record<string, string> = {
    today: "today",
    "7d": "7d",
    "30d": "30d",
    "90d": "90d",
    ytd: "ytd",
    all: "all",
  };
  return map[period] ?? "30d";
}

export function filtersWithGlobalPeriod(period: string, base: FilterState = EMPTY_FILTERS): FilterState {
  return { ...base, preset: globalPeriodToPreset(period) };
}

export type MetricKey = "expectancy_r" | "net_pnl" | "average_r" | "win_rate" | "n";

export function metricValue(row: GroupRow, metric: MetricKey): number | null {
  if (metric === "n") return row.n;
  const raw = row[metric];
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

/** Live CSS-token colours. Chart components should also subscribe to theme via useTheme(). */
export const CHART = {
  get pos() {
    return liveChartTheme().pos;
  },
  get neg() {
    return liveChartTheme().neg;
  },
  get ink() {
    return liveChartTheme().ink;
  },
  get muted() {
    return liveChartTheme().muted;
  },
  get line() {
    return liveChartTheme().line;
  },
  get blue() {
    return liveChartTheme().blue;
  },
  get amber() {
    return liveChartTheme().amber;
  },
  get bg() {
    return liveChartTheme().bg;
  },
};
