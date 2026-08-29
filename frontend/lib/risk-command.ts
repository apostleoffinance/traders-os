export type RiskGauge = {
  limit: string;
  used: string;
  remaining: string;
  used_pct: number;
};

export type RiskCommand = {
  account: {
    id: string;
    name: string;
    firm: string;
    program: string;
    currency: string;
  };
  status: "green" | "yellow" | "red";
  reasons: string[];
  risk_radar: {
    score: number;
    label: "HEALTHY" | "CAUTION" | "HALT" | string;
    gauges: {
      daily_loss: RiskGauge;
      drawdown: RiskGauge;
      trades_today: {
        limit: string;
        used: string;
        remaining: string;
        used_pct: number;
      };
    };
  };
  trading_capacity: {
    full_risk_trades_remaining: number;
    half_risk_trades_remaining: number;
    risk_per_trade: string;
    daily_loss_used: string;
    daily_loss_limit: string;
    daily_loss_used_pct: number;
  };
  survival_mode: {
    firm: string;
    program: string;
    account_name: string;
    currency: string;
    starting_balance: string;
    equity: string;
    phase: string;
    profit_target: RiskGauge | null;
    max_daily_loss: RiskGauge;
    max_drawdown: RiskGauge;
  };
  metrics: {
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
  };
  limits: {
    personal_daily_loss: RiskGauge;
    personal_max_drawdown: RiskGauge;
    firm_daily_loss: RiskGauge;
    firm_max_drawdown: RiskGauge;
  };
  events: {
    event_type: string;
    severity: string;
    message: string;
    metric_value: string | null;
    threshold_value: string | null;
  }[];
};
