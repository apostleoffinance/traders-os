import { api } from "@/lib/api";
import type { MarketInstrument, MarketStatusResponse, OhlcvResponse } from "./types";

export type FetchOhlcvParams = {
  symbol: string;
  timeframe: string;
  limit?: number;
  provider?: string | null;
  signal?: AbortSignal;
};

export async function fetchOhlcv(params: FetchOhlcvParams): Promise<OhlcvResponse> {
  const q = new URLSearchParams({
    symbol: params.symbol,
    timeframe: params.timeframe,
    limit: String(params.limit ?? 500),
  });
  if (params.provider) q.set("provider", params.provider);
  return api<OhlcvResponse>(`/api/market/ohlcv?${q.toString()}`, {
    signal: params.signal,
  });
}

export async function fetchMarketInstruments(): Promise<MarketInstrument[]> {
  const res = await api<{ instruments: MarketInstrument[] }>("/api/market/instruments");
  return res.instruments ?? [];
}

export async function fetchMarketStatus(): Promise<MarketStatusResponse> {
  return api<MarketStatusResponse>("/api/market/status");
}
