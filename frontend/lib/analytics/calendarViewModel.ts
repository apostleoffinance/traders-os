import type { AnalyticsDashboard, GroupRow } from "@/lib/analytics";
import {
  MONTH_LABELS,
  buildMonthCells,
  buildYearMonthMatrix,
  dayPerformanceValue,
  monthlyRByKey,
  type CalendarDay,
  type MonthCell,
} from "./calendar-view";

export type YearMonth = { year: number; month: number };

export type SnapshotDay = {
  date: string;
  label: string;
  n: number;
  r: number | null;
  netPnl: number;
};

export type RhythmRow = {
  key: string;
  label: string;
  n: number;
  avgR: number | null;
  winRate: number | null;
  netPnl: number | null;
};

export type CalendarViewModel = {
  timezone: string;
  periodLabel: string;
  tradingDays: number;
  totalTrades: number;
  netR: number | null;
  profitableDays: number;
  losingDays: number;
  bestDay: SnapshotDay | null;
  worstDay: SnapshotDay | null;
  bestWeekday: RhythmRow | null;
  weekdayRhythm: RhythmRow[];
  sessionRhythm: RhythmRow[];
  monthlyCells: MonthCell[];
  monthlyMatrix: ReturnType<typeof buildYearMonthMatrix>;
  earlyHistory: boolean;
  earlyNote: string | null;
  days: CalendarDay[];
};

const MONTH_SHORT = MONTH_LABELS;

export function todayYearMonth(timeZone = "UTC"): YearMonth {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const now = new Date();
    return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
  }
  return { year, month };
}

/** YYYY-MM-DD for “today” in the account timezone. */
export function todayISODate(timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function shortDayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  return `${MONTH_SHORT[m - 1]} ${d}`;
}

/** Drop calendar days after today — future exit timestamps must not appear. */
export function excludeFutureCalendarDays(days: CalendarDay[], timeZone = "UTC"): CalendarDay[] {
  const today = todayISODate(timeZone);
  return days.filter((d) => d.date <= today);
}

/**
 * Nav range: earliest real traded month → today.
 * Never allow navigation into future months (even if bad exit timestamps exist).
 */
export function calendarNavBounds(days: CalendarDay[], timeZone = "UTC"): { min: YearMonth; max: YearMonth } {
  const today = todayYearMonth(timeZone);
  const traded = excludeFutureCalendarDays(days, timeZone)
    .filter((d) => d.n > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!traded.length) return { min: today, max: today };
  const [y0, m0] = traded[0].date.split("-").map(Number);
  const min = { year: y0, month: m0 };
  if (compareYearMonth(min, today) > 0) return { min: today, max: today };
  return { min, max: today };
}

/**
 * Open to the current calendar month when it falls in the navigable range.
 * Never opens to a future month.
 */
export function preferredCalendarMonth(days: CalendarDay[], timeZone = "UTC"): YearMonth {
  const today = todayYearMonth(timeZone);
  const bounds = calendarNavBounds(days, timeZone);
  if (compareYearMonth(today, bounds.min) >= 0 && compareYearMonth(today, bounds.max) <= 0) {
    return today;
  }
  if (compareYearMonth(today, bounds.max) > 0) return bounds.max;
  return bounds.min;
}

export function clampYearMonth(cursor: YearMonth, bounds: { min: YearMonth; max: YearMonth }): YearMonth {
  if (compareYearMonth(cursor, bounds.min) < 0) return bounds.min;
  if (compareYearMonth(cursor, bounds.max) > 0) return bounds.max;
  return cursor;
}

function weekdayLabel(key: string): string {
  const map: Record<string, string> = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday",
  };
  return map[key.toLowerCase()] ?? key;
}

function sessionDisplay(key: string): string {
  const map: Record<string, string> = {
    asia: "Asia",
    london: "London",
    new_york: "New York",
    london_ny_overlap: "London / NY",
    outside: "Outside",
  };
  return map[key] ?? key;
}

function rhythmFromGroup(row: GroupRow, labelOf: (k: string) => string): RhythmRow {
  const avg =
    row.average_r != null
      ? Number(row.average_r)
      : row.expectancy_r != null
        ? Number(row.expectancy_r)
        : null;
  return {
    key: row.key,
    label: labelOf(row.key),
    n: row.n,
    avgR: avg != null && Number.isFinite(avg) ? avg : null,
    winRate: row.win_rate != null ? Number(row.win_rate) : null,
    netPnl: row.net_pnl != null ? Number(row.net_pnl) : null,
  };
}

const WEEKDAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function weekdaySortKey(key: string): number {
  const i = WEEKDAY_ORDER.indexOf(key.toLowerCase());
  if (i >= 0) return i;
  const short = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].indexOf(key.toLowerCase().slice(0, 3));
  return short >= 0 ? short : 99;
}

/**
 * Canonical calendar view model from dashboard lab temporal data.
 * Prefer exit-day calendar (lab.temporal.calendar) for day/month R reconciliation.
 */
export function buildCalendarViewModel(data: AnalyticsDashboard): CalendarViewModel | null {
  const t = data.lab?.temporal;
  if (!t) return null;

  const timezone = t.calendar.timezone || "UTC";
  const days = excludeFutureCalendarDays(t.calendar.days, timezone);
  const traded = days.filter((d) => d.n > 0);
  const totalTrades = traded.reduce((s, d) => s + d.n, 0);

  const byR = [...traded].sort((a, b) => {
    const av = dayPerformanceValue(a) ?? Number(a.net_pnl);
    const bv = dayPerformanceValue(b) ?? Number(b.net_pnl);
    return bv - av;
  });

  const best = byR[0] ?? null;
  const worst = byR.length > 1 ? byR[byR.length - 1] : null;
  const worstDistinct = worst && best && worst.date !== best.date ? worst : null;

  const toSnap = (d: CalendarDay): SnapshotDay => ({
    date: d.date,
    label: shortDayLabel(d.date),
    n: d.n,
    r: d.r != null ? Number(d.r) : null,
    netPnl: Number(d.net_pnl),
  });

  const weekdayRhythm = [...t.weekday]
    .filter((w) => w.n > 0)
    .map((w) => rhythmFromGroup(w, weekdayLabel))
    .sort((a, b) => weekdaySortKey(a.key) - weekdaySortKey(b.key));

  const bestWeekday =
    [...weekdayRhythm].sort((a, b) => (b.avgR ?? -Infinity) - (a.avgR ?? -Infinity))[0] ?? null;

  const sessions = data.sessions ?? [];
  const sessionRhythm = sessions
    .filter((s) => s.n > 0)
    .map((s) => rhythmFromGroup(s, sessionDisplay))
    .sort((a, b) => (b.avgR ?? -Infinity) - (a.avgR ?? -Infinity));

  const monthlyCells = buildMonthCells(t.monthly.rows, days);
  const monthlyMatrix = buildYearMonthMatrix(monthlyCells);

  const rMap = monthlyRByKey(days);
  let netR: number | null = null;
  if (rMap.size) {
    netR = 0;
    for (const v of rMap.values()) netR += v;
  } else {
    const withR = traded.filter((d) => d.r != null);
    if (withR.length) {
      netR = withR.reduce((s, d) => s + Number(d.r), 0);
    }
  }

  const profitableDays = traded.filter((d) => (dayPerformanceValue(d) ?? 0) > 0).length;
  const losingDays = traded.filter((d) => (dayPerformanceValue(d) ?? 0) < 0).length;
  const earlyHistory = totalTrades > 0 && totalTrades < 10;

  return {
    timezone,
    periodLabel: data.filters.preset,
    tradingDays: traded.length,
    totalTrades,
    netR,
    profitableDays,
    losingDays,
    bestDay: best ? toSnap(best) : null,
    worstDay: worstDistinct ? toSnap(worstDistinct) : null,
    bestWeekday,
    weekdayRhythm,
    sessionRhythm,
    monthlyCells,
    monthlyMatrix,
    earlyHistory,
    earlyNote: earlyHistory
      ? `${totalTrades} trade${totalTrades === 1 ? "" : "s"} across ${traded.length} trading day${
          traded.length === 1 ? "" : "s"
        }. Patterns are still forming.`
      : null,
    days,
  };
}

/** Consistency checks for calendar aggregations (tests + debug). */
export function reconcileCalendarTotals(vm: CalendarViewModel): {
  ok: boolean;
  dailyTrades: number;
  monthlyTrades: number;
  issues: string[];
} {
  const dailyTrades = vm.days.filter((d) => d.n > 0).reduce((s, d) => s + d.n, 0);
  const monthlyTrades = vm.monthlyCells.reduce((s, c) => s + c.n, 0);
  const issues: string[] = [];
  if (dailyTrades !== vm.totalTrades) {
    issues.push(`daily trades ${dailyTrades} ≠ totalTrades ${vm.totalTrades}`);
  }
  // Monthly rows may use entry-day bucketing while calendar uses exit-day — flag only large gaps
  if (monthlyTrades > 0 && Math.abs(monthlyTrades - dailyTrades) > 0) {
    issues.push(`monthly trades ${monthlyTrades} ≠ daily trades ${dailyTrades} (possible entry vs exit bucketing)`);
  }
  if (vm.bestDay) {
    const found = vm.days.find((d) => d.date === vm.bestDay!.date);
    if (!found || found.n <= 0) issues.push("bestDay missing from calendar days");
  }
  return {
    ok: issues.length === 0 || (issues.length === 1 && issues[0].includes("entry vs exit")),
    dailyTrades,
    monthlyTrades,
    issues,
  };
}
