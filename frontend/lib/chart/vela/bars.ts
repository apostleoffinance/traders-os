import type { MarketCandle } from "@/lib/market-data/types";

/** Vela OHLCV bar shape (epoch ms open time). */
export type VelaBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

function num(v: number | string | null | undefined, fallback = 0): number {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function candleToVelaBar(c: MarketCandle): VelaBar {
  const time = Date.parse(c.timestamp);
  return {
    time: Number.isFinite(time) ? time : 0,
    open: num(c.open),
    high: num(c.high),
    low: num(c.low),
    close: num(c.close),
    volume: c.volume == null || c.volume === "" ? undefined : num(c.volume),
  };
}

export function candlesToVelaBars(candles: MarketCandle[]): VelaBar[] {
  const bars = candles.map(candleToVelaBar).filter((b) => b.time > 0);
  bars.sort((a, b) => a.time - b.time);
  const out: VelaBar[] = [];
  let last = -1;
  for (const b of bars) {
    if (b.time === last) {
      out[out.length - 1] = b;
    } else {
      out.push(b);
      last = b.time;
    }
  }
  return out;
}
