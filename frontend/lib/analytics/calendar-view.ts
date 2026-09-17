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

export type MonthGridCell = {
  /** YYYY-MM-DD when in month; null for padding. */
  date: string | null;
  dayOfMonth: number | null;
  inMonth: boolean;
  day: CalendarDay | null;
};

/** Monday-first month grid with empty padding cells. Days keyed by YYYY-MM-DD. */
export function buildMonthGrid(year: number, month: number, days: CalendarDay[]): MonthGridCell[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = new Date(Date.UTC(year, month - 1, 1));
  const mondayIndex = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: MonthGridCell[] = [];

  for (let i = 0; i < mondayIndex; i++) {
    cells.push({ date: null, dayOfMonth: null, inMonth: false, day: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({
      date,
      dayOfMonth: d,
      inMonth: true,
      day: byDate.get(date) ?? null,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, dayOfMonth: null, inMonth: false, day: null });
  }
  return cells;
}

export function shiftYearMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** @deprecated Prefer preferredCalendarMonth from calendarViewModel (opens to today, never future). */
export function initialCalendarMonth(days: CalendarDay[]): { year: number; month: number } {
  const now = new Date();
  const today = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  const todayIso = `${today.year}-${String(today.month).padStart(2, "0")}-28`;
  const traded = days
    .filter((d) => d.n > 0 && d.date <= todayIso.slice(0, 8) + "31")
    .filter((d) => {
      const [y, m] = d.date.split("-").map(Number);
      return y * 12 + m <= today.year * 12 + today.month;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!traded.length) return today;
  const [y0, m0] = traded[0].date.split("-").map(Number);
  const min = { year: y0, month: m0 };
  if (min.year * 12 + min.month > today.year * 12 + today.month) return today;
  return today;
}

export function dayPerformanceValue(day: CalendarDay | null | undefined): number | null {
  if (!day || day.n <= 0) return null;
  if (day.r != null && Number.isFinite(Number(day.r))) return Number(day.r);
  if (day.net_pnl != null && Number.isFinite(Number(day.net_pnl))) return Number(day.net_pnl);
  return null;
}

/** Display metric for calendar cells / intensity. */
export type CalendarDisplayMetric = "r" | "net_pnl" | "pct";

/**
 * Value for calendar display.
 * - r: R multiple when present
 * - net_pnl: currency P&L
 * - pct: day P&L as % of period starting equity (when equityBase provided)
 */
export function dayDisplayValue(
  day: CalendarDay | null | undefined,
  metric: CalendarDisplayMetric,
  equityBase: number | null = null,
): number | null {
  if (!day || day.n <= 0) return null;
  if (metric === "r") {
    if (day.r != null && Number.isFinite(Number(day.r))) return Number(day.r);
    return null;
  }
  if (metric === "net_pnl") {
    if (day.net_pnl != null && Number.isFinite(Number(day.net_pnl))) return Number(day.net_pnl);
    return null;
  }
  // pct
  if (equityBase == null || !Number.isFinite(equityBase) || equityBase === 0) return null;
  if (day.net_pnl == null || !Number.isFinite(Number(day.net_pnl))) return null;
  return (Number(day.net_pnl) / Math.abs(equityBase)) * 100;
}

/** 0–1 intensity for restrained calendar fills. */
export function dayIntensity(value: number, maxAbs: number): number {
  if (maxAbs <= 0 || !Number.isFinite(value)) return 0.2;
  return 0.18 + Math.min(1, Math.abs(value) / maxAbs) * 0.55;
}

export function formatMonthTitle(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

export const WEEKDAY_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
