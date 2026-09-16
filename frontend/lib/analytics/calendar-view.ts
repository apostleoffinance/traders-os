import type { AnalyticsDashboard } from "@/lib/analytics";

export type CalendarDay = NonNullable<
  NonNullable<AnalyticsDashboard["lab"]>["temporal"]
>["calendar"]["days"][number];

export type MonthlyRow = NonNullable<
  NonNullable<AnalyticsDashboard["lab"]>["temporal"]
>["monthly"]["rows"][number];

export type MonthCell = {
  key: string; // YYYY-MM
  year: number;
  month: number; // 1-12
  n: number;
  netPnl: number;
  /** Sum of daily R in the month when available; null if no R days. */
  r: number | null;
  winRate: number | null;
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export { MONTH_LABELS };

/** Aggregate calendar days into YYYY-MM R totals (deterministic). */
export function monthlyRByKey(days: CalendarDay[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of days) {
    if (d.r == null || !Number.isFinite(Number(d.r))) continue;
    const key = d.date.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + Number(d.r));
  }
  return map;
}

export function buildMonthCells(rows: MonthlyRow[], days: CalendarDay[]): MonthCell[] {
  const rMap = monthlyRByKey(days);
  return rows.map((row) => {
    const [y, m] = row.month.split("-").map(Number);
    const r = rMap.has(row.month) ? rMap.get(row.month)! : null;
    return {
      key: row.month,
      year: y,
      month: m,
      n: row.n,
      netPnl: Number(row.net_pnl),
      r,
      winRate: row.win_rate != null ? Number(row.win_rate) : null,
    };
  });
}

/** Years descending × months 1–12 matrix for heatmap. */
export function buildYearMonthMatrix(cells: MonthCell[]): {
  years: number[];
  byKey: Map<string, MonthCell>;
  maxAbsR: number;
} {
  const byKey = new Map(cells.map((c) => [c.key, c]));
  const yearSet = new Set(cells.map((c) => c.year));
  // Ensure current calendar year appears even if empty (visual continuity)
  if (yearSet.size === 0) yearSet.add(new Date().getUTCFullYear());
  const years = [...yearSet].sort((a, b) => b - a);
  let maxAbsR = 0;
  for (const c of cells) {
    const v = c.r ?? c.netPnl;
    if (Number.isFinite(v)) maxAbsR = Math.max(maxAbsR, Math.abs(v));
  }
  if (maxAbsR <= 0) maxAbsR = 2;
  return { years, byKey, maxAbsR };
}

export function monthRangeBounds(key: string): { from: string; to: string } {
  const [year, month] = key.split("-");
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return {
    from: `${key}-01`,
    to: `${key}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function heatColor(value: number, maxAbs: number, posRgb: string, negRgb: string): string {
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  const alpha = 0.12 + intensity * 0.72;
  return value >= 0 ? `rgba(${posRgb},${alpha})` : `rgba(${negRgb},${alpha})`;
}
