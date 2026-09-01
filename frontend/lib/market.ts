export type MarketQuoteStatus = "ok" | "stale" | "unavailable";

export type MarketQuote = {
  symbol: string;
  display_symbol: string;
  asset_class: string;
  price?: number;
  previous_price?: number | null;
  change?: number | null;
  change_percent?: number | null;
  change_basis?: string;
  direction?: "up" | "down" | "flat";
  timestamp?: string | null;
  provider?: string;
  is_stale?: boolean;
  status: MarketQuoteStatus;
  freshness?: string;
  age_seconds?: number | null;
  warning?: string;
};

export type MarketTickerResponse = {
  updated_at: string;
  quotes: MarketQuote[];
};

export const MARKET_PULSE_POLL_MS = 15_000;
export const MARKET_PULSE_SCROLL_PX_PER_SEC = 48;

export function formatQuotePrice(price: number, assetClass: string): string {
  if (assetClass === "crypto") {
    if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 100) return price.toFixed(2);
  if (price >= 10) return price.toFixed(3);
  return price.toFixed(5);
}

export function formatChangePercent(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function changeArrow(direction: MarketQuote["direction"]): string {
  if (direction === "up") return "▲";
  if (direction === "down") return "▼";
  return "•";
}

export function normalizeInstrumentParam(raw: string | null | undefined, allowed: string[]): string | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase().replace(/\//g, "");
  return allowed.includes(key) ? key : null;
}
