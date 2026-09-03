import { fetchOhlcv } from "@/lib/market-data/client";
import { toBackendTimeframe } from "@/lib/market-data/timeframes";
import { candlesToVelaBars, type VelaBar } from "./bars";

export const NAVIQ_PROVIDER_ID = "naviq";

type BarRange = {
  from?: number;
  to?: number;
  limit?: number;
  session?: string;
};

type ProviderInfo = {
  name: string;
  displayName?: string;
  requiresApiKey?: boolean;
  supportedTimeframes?: readonly string[];
  capabilities: {
    enumerate: boolean;
    stream: boolean;
    symbolInfo: boolean;
  };
};

type SymbolDescriptor = {
  ticker: string;
  description?: string;
  type?: string;
  provider?: string;
};

export type NaviqProviderOptions = {
  /** Optional backend provider preference (dukascopy, binance, …). */
  preferredProvider?: string | null;
  /** Symbols advertised for autocomplete / bare-ticker resolve. */
  symbols?: SymbolDescriptor[];
  /** Poll interval for live forming candle (ms). */
  pollMs?: number;
  onMeta?: (meta: {
    provider: string;
    freshness: string;
    stale: boolean;
    warning?: string | null;
    count: number;
  }) => void;
};

/**
 * Vela DataProvider that loads OHLCV exclusively through NAVIQ `/api/market/ohlcv`.
 * Forex → Dukascopy (and OANDA if configured); crypto → CCXT chain — never merge series.
 */
export class NaviqDataProvider {
  private preferredProvider: string | null;
  private symbols: SymbolDescriptor[];
  private pollMs: number;
  private onMeta?: NaviqProviderOptions["onMeta"];

  constructor(opts: NaviqProviderOptions = {}) {
    this.preferredProvider = opts.preferredProvider ?? null;
    this.symbols = opts.symbols ?? [];
    this.pollMs = opts.pollMs ?? 20_000;
    this.onMeta = opts.onMeta;
  }

  setPreferredProvider(name: string | null) {
    this.preferredProvider = name;
  }

  setSymbols(symbols: SymbolDescriptor[]) {
    this.symbols = symbols;
  }

  info(): ProviderInfo {
    return {
      name: NAVIQ_PROVIDER_ID,
      displayName: "NAVIQ Market Data",
      requiresApiKey: false,
      supportedTimeframes: ["1", "5", "15", "30", "60", "240", "1D"],
      capabilities: {
        enumerate: this.symbols.length > 0,
        stream: true,
        symbolInfo: true,
      },
    };
  }

  async listSymbols(): Promise<SymbolDescriptor[]> {
    return this.symbols.map((s) => ({ ...s, provider: NAVIQ_PROVIDER_ID }));
  }

  async getSymbolInfo(ticker: string) {
    return { ticker, type: ticker.includes("USDT") ? "crypto" : "fx" };
  }

  async getBars(ticker: string, timeframe: string, range: BarRange): Promise<VelaBar[]> {
    const backendTf = toBackendTimeframe(timeframe);
    if (!backendTf) {
      throw new Error(`Unsupported timeframe for NAVIQ: ${timeframe}`);
    }
    const limit = Math.min(Math.max(range.limit ?? 500, 10), 1500);
    const res = await fetchOhlcv({
      symbol: ticker,
      timeframe: backendTf,
      limit,
      provider: this.preferredProvider,
    });
    this.onMeta?.({
      provider: res.provider,
      freshness: res.freshness,
      stale: res.stale,
      warning: res.warning,
      count: res.count,
    });
    let bars = candlesToVelaBars(res.candles);
    if (range.from != null) bars = bars.filter((b) => b.time >= range.from!);
    if (range.to != null) bars = bars.filter((b) => b.time <= range.to!);
    return bars;
  }

  subscribe(ticker: string, timeframe: string, onBar: (bar: VelaBar) => void): () => void {
    let stopped = false;
    const tick = async () => {
      if (stopped) return;
      try {
        const bars = await this.getBars(ticker, timeframe, { limit: 3 });
        const last = bars[bars.length - 1];
        if (last && !stopped) onBar(last);
      } catch {
        /* keep polling; host surfaces load errors via parked chart */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), this.pollMs);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }
}
