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
  return p.toString();
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
