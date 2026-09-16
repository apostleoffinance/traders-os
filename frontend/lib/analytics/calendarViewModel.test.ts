import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calendarNavBounds,
  clampYearMonth,
  compareYearMonth,
  preferredCalendarMonth,
  reconcileCalendarTotals,
  type CalendarViewModel,
} from "./calendarViewModel";
import type { CalendarDay } from "./calendar-view";
import { initialCalendarMonth } from "./calendar-view";

function day(date: string, n: number, r: number | null = 1): CalendarDay {
  return {
    date,
    n,
    net_pnl: String(r ?? 0),
    gross_pnl: String(r ?? 0),
    r: r != null ? String(r) : null,
    wins: r != null && r > 0 ? n : 0,
    losses: r != null && r < 0 ? n : 0,
    record: `${r != null && r > 0 ? n : 0}-${r != null && r < 0 ? n : 0}`,
  };
}

describe("preferredCalendarMonth", () => {
  it("never opens or allows nav into a future month even if a future day exists in data", () => {
    const days = [
      day("2026-08-28", 1, 1.76),
      day("2026-09-04", 1, -0.3),
      day("2026-11-09", 1, 0.29), // corrupt / future exit bucket
    ];
    const bounds = calendarNavBounds(days, "UTC");
    const preferred = preferredCalendarMonth(days, "UTC");
    const today = new Date();
    const ty = today.getUTCFullYear();
    const tm = today.getUTCMonth() + 1;
    assert.equal(bounds.max.year, ty);
    assert.equal(bounds.max.month, tm);
    assert.ok(compareYearMonth(bounds.max, { year: 2026, month: 11 }) < 0 || (ty === 2026 && tm >= 11));
    assert.ok(compareYearMonth(preferred, bounds.max) <= 0);
    assert.notEqual(preferred.month === 11 && preferred.year === 2026 && (ty < 2026 || (ty === 2026 && tm < 11)), true);
  });

  it("opens to current month when last real trades are in an older month", () => {
    const days = [day("2025-11-09", 1, 1.76), day("2025-11-10", 1, -0.3)];
    const preferred = preferredCalendarMonth(days, "UTC");
    const bounds = calendarNavBounds(days, "UTC");
    assert.ok(compareYearMonth(preferred, bounds.min) >= 0);
    assert.ok(compareYearMonth(preferred, bounds.max) <= 0);
    assert.equal(bounds.min.year, 2025);
    assert.equal(bounds.min.month, 11);
    assert.ok(compareYearMonth(bounds.max, { year: 2025, month: 11 }) >= 0);
  });

  it("does not use latest-trade-only policy from legacy initialCalendarMonth when today is later", () => {
    const days = [day("2025-11-09", 1, 1.76)];
    const legacy = initialCalendarMonth(days);
    const preferred = preferredCalendarMonth(days, "UTC");
    const bounds = calendarNavBounds(days, "UTC");
    assert.deepEqual(clampYearMonth(legacy, bounds), preferred);
  });

  it("stays on sole traded month when that month is the only activity and equals max", () => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1;
    const iso = `${y}-${String(m).padStart(2, "0")}-15`;
    const days = [day(iso, 2, 0.5)];
    const preferred = preferredCalendarMonth(days, "UTC");
    assert.equal(preferred.year, y);
    assert.equal(preferred.month, m);
  });
});

describe("reconcileCalendarTotals", () => {
  it("matches daily trade sum to totalTrades", () => {
    const days = [day("2026-08-28", 1, 1.76), day("2026-09-04", 1, -0.3), day("2026-09-05", 1, 0.29)];
    const vm = {
      timezone: "UTC",
      periodLabel: "ALL",
      tradingDays: 3,
      totalTrades: 3,
      netR: 1.75,
      profitableDays: 2,
      losingDays: 1,
      bestDay: null,
      worstDay: null,
      bestWeekday: null,
      weekdayRhythm: [],
      sessionRhythm: [],
      monthlyCells: [
        { key: "2026-08", year: 2026, month: 8, n: 1, netPnl: 1, r: 1.76, winRate: 100 },
        { key: "2026-09", year: 2026, month: 9, n: 2, netPnl: 0, r: -0.01, winRate: 50 },
      ],
      monthlyMatrix: { years: [2026], byKey: new Map(), maxAbsR: 2 },
      earlyHistory: true,
      earlyNote: null,
      days,
    } satisfies CalendarViewModel;

    const result = reconcileCalendarTotals(vm);
    assert.equal(result.dailyTrades, 3);
    assert.equal(result.monthlyTrades, 3);
    assert.equal(result.ok, true);
  });
});
