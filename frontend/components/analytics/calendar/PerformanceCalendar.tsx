"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyticsDashboard, FilterState } from "@/lib/analytics";
import type { CalendarDay } from "@/lib/analytics/calendar-view";
import {
  MONTH_LABELS,
  WEEKDAY_HEADERS,
  buildMonthGrid,
  dayDisplayValue,
  dayIntensity,
  formatMonthTitle,
  shiftYearMonth,
  type CalendarDisplayMetric,
} from "@/lib/analytics/calendar-view";
import {
  calendarNavBounds,
  clampYearMonth,
  excludeFutureCalendarDays,
  preferredCalendarMonth,
  type YearMonth,
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
  const timezone = t?.calendar.timezone || "UTC";
  const days = useMemo(
    () => excludeFutureCalendarDays(t?.calendar.days ?? [], timezone),
    [t?.calendar.days, timezone],
  );

  const equityBase = useMemo(() => {
    const curve = data.lab?.equity?.net_pnl?.curve ?? [];
    for (const p of curve) {
      const eq = Number(p.equity);
      if (Number.isFinite(eq) && eq !== 0) return eq;
    }
    return null;
  }, [data.lab?.equity?.net_pnl?.curve]);

  const bounds = useMemo(() => calendarNavBounds(days, timezone), [days, timezone]);

  const [cursor, setCursor] = useState(() => preferredCalendarMonth(days, timezone));
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [metric, setMetric] = useState<CalendarDisplayMetric>("r");

  // Clamp cursor when filter data changes — do NOT snap to latest trade month
  useEffect(() => {
    const nextBounds = calendarNavBounds(days, timezone);
    setCursor((c) => clampYearMonth(c, nextBounds));
  }, [days, timezone]);

  // If % unavailable, fall back to $
  useEffect(() => {
    if (metric === "pct" && equityBase == null) setMetric("net_pnl");
  }, [metric, equityBase]);

  const maxAbs = useMemo(() => {
    let m = 0;
    for (const d of days) {
      const v = dayDisplayValue(d, metric, equityBase);
      if (v != null) m = Math.max(m, Math.abs(v));
    }
    return m > 0 ? m : 1;
  }, [days, metric, equityBase]);

  const cells = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month, days),
    [cursor.year, cursor.month, days],
  );

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = bounds.min.year; y <= bounds.max.year; y++) list.push(y);
    return list;
  }, [bounds.min.year, bounds.max.year]);

  const monthsForYear = useMemo(() => {
    return MONTH_LABELS.map((label, i) => {
      const month = i + 1;
      const ym: YearMonth = { year: cursor.year, month };
      const beforeMin =
        ym.year < bounds.min.year || (ym.year === bounds.min.year && ym.month < bounds.min.month);
      const afterMax =
        ym.year > bounds.max.year || (ym.year === bounds.max.year && ym.month > bounds.max.month);
      return { month, label, disabled: beforeMin || afterMax };
    });
  }, [cursor.year, bounds.min, bounds.max]);

  const monthStats = useMemo(() => {
    let tradingDays = 0;
    let trades = 0;
    let sum = 0;
    let hasValue = false;
    for (const c of cells) {
      if (!c.inMonth || !c.day || c.day.n <= 0) continue;
      tradingDays += 1;
      trades += c.day.n;
      const v = dayDisplayValue(c.day, metric, equityBase);
      if (v != null) {
        sum += v;
        hasValue = true;
      }
    }
    return { tradingDays, trades, sum: hasValue ? sum : null };
  }, [cells, metric, equityBase]);

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

  function jumpTo(next: YearMonth) {
    setCursor(clampYearMonth(next, bounds));
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

  function formatCell(value: number): string {
    if (metric === "r") return `${value > 0 ? "+" : ""}${num(value, 2)}R`;
    if (metric === "pct") return `${value > 0 ? "+" : ""}${num(value, 2)}%`;
    return money(value, currency);
  }

  function formatMonthSum(sum: number): string {
    if (metric === "r") return `${signed(sum)}R`;
    if (metric === "pct") return `${signed(sum)}%`;
    return money(sum, currency);
  }

  if (!t) {
    return (
      <section className="hero-cal">
        <p className="empty">Calendar data is still loading for this filter.</p>
        <style jsx>{styles}</style>
      </section>
    );
  }

  const metricOptions: Array<{ id: CalendarDisplayMetric; label: string; disabled?: boolean }> = [
    { id: "net_pnl", label: "$" },
    { id: "r", label: "R" },
    { id: "pct", label: "%", disabled: equityBase == null },
  ];

  return (
    <section className="hero-cal" aria-labelledby="perf-cal-title">
      <header className="head">
        <div>
          <h2 id="perf-cal-title">Performance calendar</h2>
          <p className="lede">Click a trading day to investigate what happened.</p>
        </div>
        <div className="modes" role="group" aria-label="Calendar display unit">
          {metricOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={metric === opt.id ? "on" : ""}
              aria-pressed={metric === opt.id}
              disabled={opt.disabled}
              title={
                opt.id === "pct" && opt.disabled
                  ? "Percent needs equity history for this filter"
                  : opt.id === "pct"
                    ? "Day P&L as % of period starting equity"
                    : undefined
              }
              onClick={() => setMetric(opt.id)}
            >
              {opt.label}
            </button>
          ))}
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
          <div className="pickers">
            <label className="sr-only" htmlFor="cal-month">
              Month
            </label>
            <select
              id="cal-month"
              className="picker"
              value={cursor.month}
              aria-label="Select month"
              onChange={(e) => jumpTo({ year: cursor.year, month: Number(e.target.value) })}
            >
              {monthsForYear.map((m) => (
                <option key={m.month} value={m.month} disabled={m.disabled}>
                  {m.label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="cal-year">
              Year
            </label>
            <select
              id="cal-year"
              className="picker"
              value={cursor.year}
              aria-label="Select year"
              onChange={(e) => jumpTo({ year: Number(e.target.value), month: cursor.month })}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p className="month-meta">
            {monthStats.tradingDays} trading day{monthStats.tradingDays === 1 ? "" : "s"}
            {monthStats.trades ? ` · ${monthStats.trades} trade${monthStats.trades === 1 ? "" : "s"}` : ""}
            {monthStats.sum != null ? ` · ${formatMonthSum(monthStats.sum)}` : ""}
          </p>
          {metric === "pct" ? (
            <p className="pct-note">% of period starting equity</p>
          ) : null}
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
          const value = dayDisplayValue(day, metric, equityBase);
          const tone = value == null ? "flat" : value > 0 ? "pos" : value < 0 ? "neg" : "flat";
          const intensity = value == null ? 0 : dayIntensity(value, maxAbs);
          const selected = selectedDay?.date === cell.date;
          const resultText = value == null ? "" : formatCell(value);
          const aria = traded
            ? `${formatDrillDayLabel(cell.date)}. ${day!.n} trade${day!.n === 1 ? "" : "s"}. ${
                value != null
                  ? value > 0
                    ? `Profit of ${resultText}`
                    : value < 0
                      ? `Loss of ${resultText}`
                      : `Breakeven ${resultText}`
                  : metric === "r"
                    ? "No R recorded"
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
              {traded && day && value == null && metric === "r" ? (
                <span className="val flat">—</span>
              ) : null}
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
    min-width: 0;
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    flex-wrap: wrap;
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
  .modes {
    display: inline-flex;
    gap: 4px;
    padding: 3px;
    border-radius: 999px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .modes button {
    border: 0;
    background: transparent;
    color: var(--text-muted);
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    min-width: 32px;
  }
  .modes button.on {
    background: var(--accent-soft, color-mix(in srgb, var(--accent) 16%, transparent));
    color: var(--accent);
  }
  .modes button:disabled {
    opacity: 0.35;
    cursor: default;
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
    min-width: 0;
  }
  .pickers {
    display: inline-flex;
    gap: 6px;
    justify-content: center;
    align-items: center;
  }
  .picker {
    appearance: auto;
    margin: 0;
    padding: 4px 8px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-primary);
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    cursor: pointer;
  }
  .picker:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .month-meta {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
  .pct-note {
    margin: 0;
    font-size: 11px;
    color: var(--text-muted);
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
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
    flex-shrink: 0;
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
    min-height: 56px;
    border-radius: 8px;
    border: 1px solid transparent;
    padding: 5px 6px;
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
    min-height: 28px;
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
    .cell { min-height: 48px; padding: 4px; }
    .val { font-size: 10px; }
    .n { font-size: 9px; }
    .picker { font-size: 0.95rem; }
  }
`;
