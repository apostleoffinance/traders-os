export type User = {
  id: string;
  email: string;
  display_name: string;
  timezone: string;
  reminders_enabled: boolean;
  created_at: string;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
};

export type PreferredWindow = {
  name: string;
  timezone: string;
  start: string;
  end: string;
};

export type RiskProfile = {
  id: string;
  account_id: string;
  risk_per_trade: string;
  personal_daily_loss_limit: string;
  personal_max_drawdown: string;
  firm_daily_drawdown_limit: string;
  firm_max_drawdown_limit: string;
  max_trades_per_day: number;
  preferred_min_rr: string;
  preferred_rr: string;
  minimum_trading_days: number;
  profit_split: string | null;
  payout_cap: string | null;
  hard_risk_per_trade: string | null;
  risk_per_trade_enforcement: string;
  hard_risk_enforcement: string;
  drawdown_basis: string;
  preferred_windows: PreferredWindow[];
  extra_restrictions: Record<string, unknown>;
  notes: string | null;
};

export type Account = {
  id: string;
  user_id: string;
  firm: string;
  program: string;
  account_name: string;
  currency: string;
  starting_balance: string;
  current_balance: string;
  current_equity: string;
  status: string;
  created_at: string;
  updated_at: string;
  risk_profile: RiskProfile | null;
};

export type Setup = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  active: boolean;
};

export type ChecklistItem = {
  id: string;
  label: string;
  description: string | null;
  category: string;
  kind: "manual" | "automatic";
  auto_key: string | null;
  sort_order: number;
  required: boolean;
};

export type ChecklistTemplate = {
  id: string;
  name: string;
  description: string | null;
  setup_id: string | null;
  instrument: string | null;
  is_default: boolean;
  active: boolean;
  items: ChecklistItem[];
};

export type ChecklistLibrary = {
  categories: { key: string; label: string }[];
  auto_items: {
    label: string;
    category: string;
    kind: string;
    auto_key: string | null;
    required: boolean;
    description: string | null;
  }[];
  shared_manual: {
    label: string;
    category: string;
    kind: string;
    auto_key: string | null;
    required: boolean;
    description: string | null;
  }[];
  setup_presets: Record<string, { label: string; category: string; kind: string; required: boolean }[]>;
  instruments: string[];
  helper: string;
};

export type Instrument = {
  symbol: string;
  quote_currency: string;
  price_decimals: number;
};

export type Psychology = {
  emotion_before: string;
  emotion_during: string;
  emotion_after: string;
  emotional_intensity: number;
  confidence: number;
  fear: number;
  fomo: number;
  frustration: number;
  revenge: number;
  boredom: number;
  notes: string | null;
};

export type Screenshot = {
  id: string;
  type: string;
  storage_key: string;
  url: string;
  original_filename: string | null;
  created_at: string;
};

export type Trade = {
  id: string;
  user_id: string;
  account_id: string;
  symbol: string;
  direction: string;
  trade_timestamp: string;
  exit_timestamp: string | null;
  timezone: string;
  session: string;
  in_preferred_session: boolean;
  setup_id: string | null;
  setup_name: string | null;
  timeframe: string;
  entry_price: string;
  exit_price: string | null;
  stop_loss: string;
  take_profit: string | null;
  lot_size: string;
  stop_pips: string | null;
  tp_pips: string | null;
  risk_amount: string;
  risk_percent: string;
  planned_reward: string | null;
  planned_rr: string | null;
  realized_pnl: string | null;
  realized_r: string | null;
  realized_rr: string | null;
  result: string;
  status: string;
  holding_time_seconds: number | null;
  setup_valid: boolean;
  rules_followed: boolean;
  emotional_trade: boolean;
  mistake: boolean;
  mistake_notes: string | null;
  notes: string | null;
  discipline_score: number | null;
  acknowledged_warnings: boolean;
  created_at: string;
  psychology: (Psychology & { id: string; trade_id: string }) | null;
  screenshots: Screenshot[];
  checklist: {
    item_id: string;
    checked: boolean;
    label: string | null;
    category: string | null;
    kind: string | null;
    auto_key: string | null;
    required: boolean | null;
  }[];
  warnings: string[];
};

export type AutoCheck = {
  auto_key: string;
  label: string;
  passed: boolean;
  status: "valid" | "warning" | "blocked";
  display: string;
  value: string | null;
  threshold: string | null;
};

export type TradePreview = {
  symbol: string;
  stop_pips: string;
  tp_pips: string | null;
  risk_amount: string;
  risk_percent: string;
  planned_reward: string | null;
  planned_rr: string | null;
  estimated_pnl_at_tp: string | null;
  validation_notes: string[];
  warnings: string[];
  session: string | null;
  in_preferred_session: boolean;
  process_status: "valid" | "warning" | "blocked";
  policy: {
    allowed: boolean;
    requires_confirmation: boolean;
    block_reason: string | null;
  } | null;
  auto_checks: AutoCheck[];
  trades_today: number;
  max_trades_per_day: number | null;
};

export type Dashboard = {
  account: {
    id: string;
    name: string;
    firm: string;
    program: string;
    currency: string;
    status: string;
  };
  balance: string;
  equity: string;
  starting_balance: string;
  daily_pnl: string;
  total_pnl: string;
  drawdown: string;
  drawdown_pct: string;
  max_drawdown: string;
  win_rate: string | null;
  expectancy_r: string | null;
  profit_factor: string | null;
  average_r: string | null;
  n_trades: number;
  current_streak_losses: number;
  current_streak_wins: number;
  discipline_score: number | null;
  trading_health: number | null;
  trading_health_status: "insufficient_data" | "scored";
  trading_health_trades_needed: number;
  trading_health_summary: string;
  health: {
    score: number | null;
    status: "insufficient_data" | "scored";
    trades_needed: number;
  };
  health_components: Record<string, number>;
  risk_status: "green" | "yellow" | "red";
  risk_reasons: string[];
  trades_today: number;
  max_trades_per_day: number;
  distance_to_personal_daily_loss: string;
  distance_to_personal_max_dd: string;
  distance_to_firm_daily_dd: string;
  distance_to_firm_max_dd: string;
  personal_daily_loss: { limit: string; remaining: string };
  personal_max_dd: { limit: string; remaining: string };
  firm_daily_dd: { limit: string; remaining: string };
  firm_max_dd: { limit: string; remaining: string };
  equity_series: { t: string; balance: string }[];
  sample_note: string | null;
  sharpe: string | null;
  sharpe_note: { available: boolean; reason: string | null; n: number };
  sortino: string | null;
  sortino_note: { available: boolean; reason: string | null; n: number };
};

export type GroupStat = {
  key: string;
  n: number;
  net_pnl: string;
  expectancy_r: string | null;
  win_rate: string | null;
  average_r: string | null;
  profit_factor: string | null;
  insight: string | null;
};

export type RiskStatus = {
  status: "green" | "yellow" | "red";
  reasons: string[];
  daily_pnl: string;
  daily_risk: string;
  trades_today: number;
  consecutive_losses: number;
  consecutive_wins: number;
  current_drawdown: string;
  current_drawdown_pct: string;
  max_drawdown: string;
  avg_risk_last_n: string | null;
  risk_escalation_pct: string | null;
  distance_to_personal_daily_loss: string;
  distance_to_firm_daily_dd: string;
  distance_to_personal_max_dd: string;
  distance_to_firm_max_dd: string;
  events: {
    event_type: string;
    severity: string;
    message: string;
    metric_value: string | null;
    threshold_value: string | null;
  }[];
};

export type EquityPoint = {
  at: string;
  equity: string;
  peak: string;
  drawdown: string;
  drawdown_pct: string;
  daily_pnl: string;
  cumulative_r: string;
};
