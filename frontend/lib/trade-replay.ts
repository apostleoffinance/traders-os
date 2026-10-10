export type ReplayInsight = {
  tone: "ok" | "warn" | "bad" | "neutral" | "info" | string;
  text: string;
  detail?: string | null;
};

export type ReplayContextCard = {
  label: string;
  value: string;
};

export type ReplayTimelineEvent = {
  phase: string;
  at?: string;
  label: string;
  price?: string | null;
  time_label?: string;
  duration_seconds?: number;
  detail?: string;
};

export type TradeReplayExcursions = {
  mfe_price: string | null;
  mae_price: string | null;
  mfe_r: string | null;
  mae_r: string | null;
  mfe_at?: string | null;
  mae_at?: string | null;
  /** Progress along hold [0,1] when timed. */
  mfe_t?: number | null;
  mae_t?: number | null;
  source: string | null;
  precision: string | null;
  timing_precision?: string | null;
};

export type TradeReplayMetrics = {
  realized_r: string | null;
  planned_rr: string | null;
  holding_time_seconds: number | null;
  risk_amount: string | null;
};

export type TradeReplayMovement = {
  unit: string;
  label: string;
  short_label: string;
  precision: number;
  risk: string | null;
  target: string | null;
  realized: string | null;
  mfe: string | null;
  mae: string | null;
  capture_percent: string | null;
  left_on_table: string | null;
  status: string;
};

export type TradeReplayPriceSeriesPoint = {
  at: string;
  t: number;
  open: string;
  high: string;
  low: string;
  close: string;
};

export type TradeReplayPriceSeries = {
  source: string;
  provider?: string | null;
  timeframe: string;
  bar_count: number;
  point_count: number;
  downsampled: boolean;
  window_start?: string;
  window_end?: string;
  first_bar_at?: string;
  last_bar_at?: string;
  coverage_status?: string;
  gap_count?: number;
  largest_gap_seconds?: number;
  gaps?: { from: string; to: string; duration_seconds: number; missing_m1_bars_estimate: number }[];
  long_intervals?: { from: string; to: string; duration_seconds: number; missing_m1_bars_estimate: number }[];
  gap_note?: string;
  points: TradeReplayPriceSeriesPoint[];
};

export type TradeMarketSnapshot = {
  status: "available" | "unavailable" | "persistence_failed" | string;
  id?: string;
  version?: number;
  fingerprint?: string;
  provider?: string;
  timeframe?: string;
  window_start?: string;
  window_end?: string;
  captured_at?: string;
  candle_count?: number;
  gap_count?: number;
  largest_gap_seconds?: number;
  coverage_status?: string;
  immutable_snapshot?: boolean;
  reason?: string;
};

export type TradeReplay = {
  trade_id: string;
  symbol: string;
  direction: string;
  status: string;
  timeframe: string;
  session: string;
  timeline: ReplayTimelineEvent[];
  price_path: {
    entry_y: number | null;
    stop_y: number | null;
    target_y: number | null;
    exit_y: number | null;
    favorable: boolean | null;
    direction: string;
  };
  levels: {
    entry: string;
    stop_loss: string;
    take_profit: string | null;
    exit: string | null;
  };
  excursions?: TradeReplayExcursions;
  metrics?: TradeReplayMetrics;
  movement?: TradeReplayMovement;
  /** Optional M1 OHLC path for the hold window — absent when market data unavailable. */
  price_series?: TradeReplayPriceSeries | null;
  market_snapshot?: TradeMarketSnapshot;
  context: {
    pre_trade: ReplayContextCard[];
    execution: ReplayContextCard[];
    post_trade: ReplayContextCard[];
  };
  decision_replay: {
    at_entry: ReplayInsight[];
    after: ReplayInsight[];
  };
  decision_quality: {
    process_score: number;
    outcome_r: string | null;
    outcome_label: string;
    headline: string;
  };
};
