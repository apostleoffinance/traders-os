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
