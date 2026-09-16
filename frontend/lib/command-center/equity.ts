import type { EquityPt } from "@/lib/analytics";
import type { Trade } from "@/lib/types";
import type { PeriodPreset } from "@/lib/filters";
import { isTimestampInPeriod } from "./period";

/** Closed trades in the selected Home period (by exit time). */
export function closedTradesInPeriod(trades: Trade[], period: PeriodPreset): Trade[] {
  return [...trades]
    .filter(
      (t) =>
        t.status === "closed" &&
        isTimestampInPeriod(t.exit_timestamp ?? t.trade_timestamp, period),
    )
    .sort(
      (a, b) =>
        Date.parse(a.exit_timestamp ?? a.trade_timestamp) -
        Date.parse(b.exit_timestamp ?? b.trade_timestamp),
    );
}

/**
 * Build equity observations from closed trades in-period.
 * Domain matches actual trade exits — no fabricated future dates.
 */
export function buildEquityFromTrades(trades: Trade[], startingBalance: number): EquityPt[] {
  const closed = [...trades]
    .filter((t) => t.status === "closed" && t.exit_timestamp && t.realized_pnl != null)
    .sort((a, b) => Date.parse(a.exit_timestamp!) - Date.parse(b.exit_timestamp!));

  if (!closed.length) return [];

  let equity = startingBalance;
  let peak = startingBalance;
  const points: EquityPt[] = [];

  const firstAt = closed[0].trade_timestamp || closed[0].exit_timestamp!;
  points.push({
    at: firstAt,
    equity: String(startingBalance),
    peak: String(startingBalance),
    drawdown: "0",
    drawdown_pct: "0",
    daily_pnl: "0",
    cumulative_r: "0",
  });

  let cumR = 0;
  for (const t of closed) {
    equity += Number(t.realized_pnl);
    peak = Math.max(peak, equity);
    const dd = Math.max(0, peak - equity);
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    if (t.realized_r != null) cumR += Number(t.realized_r);
    points.push({
      at: t.exit_timestamp!,
      equity: String(equity),
      peak: String(peak),
      drawdown: String(dd),
      drawdown_pct: String(ddPct),
      daily_pnl: t.realized_pnl ?? "0",
      cumulative_r: String(cumR),
    });
  }

  return points;
}

export function buildRCurveFromTrades(trades: Trade[]): EquityPt[] {
  const closed = [...trades]
    .filter((t) => t.status === "closed" && t.realized_r != null && t.exit_timestamp)
    .sort((a, b) => Date.parse(a.exit_timestamp!) - Date.parse(b.exit_timestamp!));

  let cum = 0;
  let peak = 0;
  return closed.map((t) => {
    cum += Number(t.realized_r);
    peak = Math.max(peak, cum);
    const dd = peak - cum;
    return {
      at: t.exit_timestamp!,
      equity: String(cum),
      peak: String(peak),
      drawdown: String(Math.max(0, dd)),
      drawdown_pct: peak !== 0 ? String((Math.max(0, dd) / Math.abs(peak)) * 100) : "0",
      daily_pnl: t.realized_r ?? "0",
      cumulative_r: String(cum),
    };
  });
}

/** Filter an existing equity series to the period (by observation time). */
export function sliceEquitySeriesByPeriod<T extends { at?: string; t?: string }>(
  series: T[],
  period: PeriodPreset,
): T[] {
  return series.filter((p) => isTimestampInPeriod(p.at ?? p.t ?? null, period));
}
