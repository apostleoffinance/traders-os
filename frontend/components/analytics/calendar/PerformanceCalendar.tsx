"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyticsDashboard, FilterState } from "@/lib/analytics";
import type { CalendarDay } from "@/lib/analytics/calendar-view";
import {
  WEEKDAY_HEADERS,
  buildMonthGrid,
  dayIntensity,
  dayPerformanceValue,
  formatMonthTitle,
  shiftYearMonth,
} from "@/lib/analytics/calendar-view";
import {
  calendarNavBounds,
  clampYearMonth,
  preferredCalendarMonth,
} from "@/lib/analytics/calendarViewModel";
import { formatDrillDayLabel } from "@/lib/analytics-drilldown";
import { money, num, signed } from "@/lib/format";
import { DayInvestigation } from "./DayInvestigation";

/**
 * Hero performance calendar — opens current month by default (not latest trade month).
 * Day click opens investigation without mutating global filters.
 */
export function PerformanceCalendar({
  data,
  filters,
}: {
  data: AnalyticsDashboard;
  filters: FilterState;
}) {
  const t = data.lab?.temporal;
  const currency = data.account.currency;
  const days = t?.calendar.days ?? [];
  const timezone = t?.calendar.timezone || "UTC";

  const bounds = useMemo(() => calendarNavBounds(days, timezone), [days, timezone]);

  const [cursor, setCursor] = useState(() => preferredCalendarMonth(days, timezone));
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  // Clamp cursor when filter data changes — do NOT snap to latest trade month
  useEffect(() => {
    const nextBounds = calendarNavBounds(days, timezone);
    setCursor((c) => clampYearMonth(c, nextBounds));
  }, [days, timezone]);

  const maxAbs = useMemo(() => {
    let m = 0;
    for (const d of days) {
      const v = dayPerformanceValue(d);
      if (v != null) m = Math.max(m, Math.abs(v));
    }
    return m > 0 ? m : 1;
  }, [days]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, days),
    [cursor.year, cursor.month, days],
  );

  const monthStats = useMemo(() => {
    let tradingDays = 0;
    let trades = 0;
    let netR = 0;
    let hasR = false;
    for (const c of cells) {
      if (!c.inMonth || !c.day || c.day.n <= 0) continue;
      tradingDays += 1;
      trades += c.day.n;
      if (c.day.r != null) {
        netR += Number(c.day.r);
        hasR = true;
      }
    }
    return { tradingDays, trades, netR: hasR ? netR : null };
  }, [cells]);

  const canPrev =
    cursor.year > bounds.min.year ||
    (cursor.year === bounds.min.year && cursor.month > bounds.min.month);
  const canNext =
    cursor.year < bounds.max.year ||
    (cursor.year === bounds.max.year && cursor.month < bounds.max.month);

  function openDay(day: CalendarDay) {
    setSelectedDay(day);
  }

  function focusDay(date: string) {
    const [y, m] = date.split("-").map(Number);
    if (y && m) setCursor(clampYearMonth({ year: y, month: m }, bounds));
    const day = days.find((d) => d.date === date);
    if (day) openDay(day);
  }

  useEffect(() => {
    const onJump = (e: Event) => {
      const detail = (e as CustomEvent<{ date?: string }>).detail;
      if (detail?.date) focusDay(detail.date);
    };
    window.addEventListener("traderos-calendar-jump", onJump);
    return () => window.removeEventListener("traderos-calendar-jump", onJump);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, bounds]);

  if (!t) {
    return (
      <section className="hero-cal">
        <p className="empty">Calendar data is still loading for this filter.</p>
        <style jsx>{styles}</style>
      </section>
    );
  }

  return (
    <section className="hero-cal" aria-labelledby="perf-cal-title">
      <header className="head">
        <div>
          <h2 id="perf-cal-title">Performance calendar</h2>
          <p className="lede">Click a trading day to investigate what happened.</p>
        </div>
      </header>

      <div className="nav">
        <button
          type="button"
          className="nav-btn"
          disabled={!canPrev}
          aria-label="Previous month"
          onClick={() => setCursor((c) => clampYearMonth(shiftYearMonth(c.year, c.month, -1), bounds))}
        >
          ‹
        </button>
        <div className="month-block">
          <h3 className="month-title">{formatMonthTitle(cursor.year, cursor.month)}</h3>
          <p className="month-meta">
            {monthStats.tradingDays} trading day{monthStats.tradingDays === 1 ? "" : "s"}
            {monthStats.trades ? ` · ${monthStats.trades} trade${monthStats.trades === 1 ? "" : "s"}` : ""}
            {monthStats.netR != null ? ` · ${signed(monthStats.netR)}R` : ""}
          </p>
        </div>
        <button
          type="button"
          className="nav-btn"
          disabled={!canNext}
          aria-label="Next month"
          onClick={() => setCursor((c) => clampYearMonth(shiftYearMonth(c.year, c.month, 1), bounds))}
        >
          ›
        </button>
      </div>

      <div
        className="grid"
        role="grid"
        aria-label={`Performance calendar ${formatMonthTitle(cursor.year, cursor.month)}`}
      >
        {WEEKDAY_HEADERS.map((h) => (
          <div key={h} className="dow" role="columnheader">
            {h}
          </div>
        ))}
        {cells.map((cell, idx) => {
          if (!cell.inMonth || !cell.date) {
            return <div key={`pad-${idx}`} className="cell pad" aria-hidden />;
          }
          const day = cell.day;
          const traded = Boolean(day && day.n > 0);
          const value = dayPerformanceValue(day);
          const tone = value == null ? "flat" : value > 0 ? "pos" : value < 0 ? "neg" : "flat";
          const intensity = value == null ? 0 : dayIntensity(value, maxAbs);
          const selected = selectedDay?.date === cell.date;
          const resultText =
            value == null
              ? ""
              : day!.r != null
                ? `${value > 0 ? "+" : ""}${num(value, 2)}R`
                : money(value, currency);
          const aria = traded
            ? `${formatDrillDayLabel(cell.date)}. ${day!.n} trade${day!.n === 1 ? "" : "s"}. ${
                value != null
                  ? value > 0
                    ? `Profit of ${resultText}`
                    : value < 0
                      ? `Loss of ${resultText}`
                      : `Breakeven ${resultText}`
                  : ""
              }. Open day investigation.`
            : `${formatDrillDayLabel(cell.date)}. No trades.`;

          return (
            <button
              key={cell.date}
              type="button"
              role="gridcell"
              className={`cell day ${traded ? `traded ${tone}` : "quiet"}${selected ? " selected" : ""}`}
              style={
                traded && tone !== "flat"
                  ? {
                      background: `color-mix(in srgb, var(--${tone === "pos" ? "pos" : "neg"}) ${Math.round(
                        intensity * 100,
                      )}%, var(--surface))`,
                    }
                  : undefined
              }
              disabled={!traded}
              aria-label={aria}
              aria-pressed={selected}
              onClick={() => day && openDay(day)}
            >
              <span className="dom">{String(cell.dayOfMonth).padStart(2, "0")}</span>
              {traded && value != null ? <span className={`val ${tone}`}>{resultText}</span> : null}
              {traded && day ? (
                <span className="n">
                  {day.n} trade{day.n === 1 ? "" : "s"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="legend" aria-hidden>
        <span>Loss</span>
        <span className="track">
          <span className="neg" />
          <span className="mid" />
          <span className="pos" />
        </span>
        <span>Profit</span>
      </div>

      <DayInvestigation
        day={selectedDay}
        baseFilters={filters}
        currency={currency}
        timezone={timezone}
        onClose={() => setSelectedDay(null)}
      />

      <style jsx>{styles}</style>
    </section>
  );
}

/** Dispatch from snapshot to jump the calendar + open day investigation. */
export function jumpCalendarToDay(date: string) {
  window.dispatchEvent(new CustomEvent("traderos-calendar-jump", { detail: { date } }));
}

const styles = `
  .hero-cal {
    display: grid;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
  }
  .head h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-primary);
  }
  .lede {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .empty {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .month-block {
    text-align: center;
    display: grid;
    gap: 2px;
  }
  .month-title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }
  .month-meta {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .nav-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-primary);
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }
  .nav-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .nav-btn:not(:disabled):hover {
    border-color: var(--accent);
  }
  .nav-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 5px;
  }
  .dow {
    text-align: center;
    font-size: 11px;
    font-weight: 650;
    color: var(--text-muted);
    padding: 4px 0;
  }
  .cell {
    min-height: 72px;
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 6px 7px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    text-align: left;
    font: inherit;
    color: inherit;
    background: transparent;
  }
  .pad {
    min-height: 48px;
  }
  .quiet {
    background: color-mix(in srgb, var(--surface-2) 40%, transparent);
    opacity: 0.55;
  }
  .traded {
    border-color: var(--border);
    cursor: pointer;
    opacity: 1;
  }
  .traded:hover {
    border-color: var(--accent);
  }
  .traded:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .selected {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 1px var(--accent);
  }
  .dom {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .traded .dom {
    color: var(--text-secondary);
  }
  .val {
    font-size: 12px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono), ui-monospace, Menlo, monospace;
    line-height: 1.2;
  }
  .val.pos { color: var(--pos); }
  .val.neg { color: var(--neg); }
  .val.flat { color: var(--text-muted); }
  .n {
    font-size: 10px;
    color: var(--text-muted);
    font-weight: 600;
  }
  .legend {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: flex-end;
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
  }
  .track {
    display: flex;
    width: 100px;
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
  }
  .track .neg { flex: 1; background: var(--neg); opacity: 0.65; }
  .track .mid { flex: 0.35; background: var(--surface-2); }
  .track .pos { flex: 1; background: var(--pos); opacity: 0.65; }
  @media (max-width: 720px) {
    .cell { min-height: 56px; padding: 4px; }
    .val { font-size: 10px; }
    .n { font-size: 9px; }
  }
`;
