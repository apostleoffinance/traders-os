export type MarketCandle = {
  symbol: string;
  provider: string;
  timeframe: string;
  timestamp: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume?: number | string | null;
};

export type OhlcvResponse = {
  provider: string;
  freshness: string;
  stale: boolean;
  warning?: string | null;
  updated_seconds_ago?: number | null;
  candles: MarketCandle[];
  count: number;
};

export type MarketInstrument = {
  symbol: string;
  display_symbol?: string;
  asset_class: string;
  providers: string[];
  timeframes: string[];
};

export type MarketStatusResponse = {
  providers: Record<string, { status: string; asset_class?: string }>;
  last_refresh?: string | null;
  cached_quotes?: number;
  ticker_symbols?: string[];
  cache_ttl_seconds?: number;
  ohlcv?: {
    endpoint: string;
    fx_chain: string[];
    crypto_chain: string[];
    preferred_provider_param: string;
  };
  chart_poc?: {
    library: string;
    data_path: string;
    route: string;
  };
};
