"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "@/components/trader/ChartCard";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import {
  filterForDateRange,
  filterForSingleDay,
  formatDrillDayLabel,
  formatDrillMonthLabel,
} from "@/lib/analytics-drilldown";
import type { AnalyticsDashboard } from "@/lib/analytics";
import {
  WEEKDAY_HEADERS,
  buildMonthGrid,
  dayIntensity,
  dayPerformanceValue,
  formatMonthTitle,
  initialCalendarMonth,
  monthRangeBounds,
  shiftYearMonth,
  type CalendarDay,
} from "@/lib/analytics/calendar-view";
import { formatR, formatSampleSize } from "@/lib/visualization";
import { money, num } from "@/lib/format";

function dayTooltip(day: CalendarDay, currency: string): string {
  const lines = [
    formatDrillDayLabel(day.date),
    day.r != null ? formatR(Number(day.r)) : money(day.net_pnl, currency),
    money(day.net_pnl, currency),
    formatSampleSize(day.n),
    day.record ? `Record ${day.record}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Interactive Monday-first performance calendar — DOM cells, day + month drilldown.
 */
export function PerformanceCalendar({ data }: { data: AnalyticsDashboard }) {
  const t = data.lab?.temporal;
  const currency = data.account.currency;
  const drill = useOptionalAnalyticsDrilldown();
  const days = t?.calendar.days ?? [];

  const bounds = useMemo(() => {
    if (!days.length) return null;
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const [y0, m0] = sorted[0].date.split("-").map(Number);
    const [y1, m1] = sorted[sorted.length - 1].date.split("-").map(Number);
    return { min: { year: y0, month: m0 }, max: { year: y1, month: m1 } };
  }, [days]);

  const [cursor, setCursor] = useState(() => initialCalendarMonth(days));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    setCursor(initialCalendarMonth(days));
    setSelectedDate(null);
  }, [days]);

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

  const monthKey = `${cursor.year}-${String(cursor.month).padStart(2, "0")}`;
  const tradedInMonth = cells.filter((c) => c.inMonth && c.day && c.day.n > 0).length;
  const tradesInMonth = cells.reduce((s, c) => s + (c.day?.n ?? 0), 0);

  const canPrev =
    bounds != null &&
    (cursor.year > bounds.min.year || (cursor.year === bounds.min.year && cursor.month > bounds.min.month));
  const canNext =
    bounds != null &&
    (cursor.year < bounds.max.year || (cursor.year === bounds.max.year && cursor.month < bounds.max.month));

  function openDay(day: CalendarDay) {
    if (!drill) return;
    setSelectedDate(day.date);
    const label = formatDrillDayLabel(day.date);
    drill.applyPatch(filterForSingleDay(day.date), label);
    drill.openTrades(`Trades on ${label}`);
  }

  function openMonth() {
    if (!drill || tradedInMonth === 0) return;
    const { from, to } = monthRangeBounds(monthKey);
    const label = formatDrillMonthLabel(monthKey);
    setSelectedDate(null);
    drill.applyPatch(filterForDateRange(from, to), label);
    drill.openTrades(`Trades in ${label}`);
  }

  /** Jump visible month to a day (e.g. from snapshot) then open it. */
  function focusAndOpenDay(date: string) {
    const [y, m] = date.split("-").map(Number);
    if (y && m) setCursor({ year: y, month: m });
    const day = days.find((d) => d.date === date);
    if (day) openDay(day);
  }

  // Expose focus for snapshot via data attribute / custom event
  useEffect(() => {
    const onJump = (e: Event) => {
      const detail = (e as CustomEvent<{ date?: string }>).detail;
      if (detail?.date) focusAndOpenDay(detail.date);
    };
    window.addEventListener("traderos-calendar-jump", onJump);
    return () => window.removeEventListener("traderos-calendar-jump", onJump);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable handler over days/drill
  }, [days, drill]);

  if (!t) {
    return (
      <ChartCard title="Performance calendar">
        <p className="empty">Calendar data is still loading for this filter.</p>
        <style jsx>{`
          .empty {
            margin: 0;
            font-size: 13px;
            color: var(--text-muted);
          }
        `}</style>
      </ChartCard>
    );
  }

  if (days.filter((d) => d.n > 0).length === 0) {
    return (
      <ChartCard title="Performance calendar">
        <div className="zero">
          <p className="zero-title">No trading data yet</p>
          <p className="zero-body">Your calendar will appear here once you close your first trade.</p>
        </div>
        <style jsx>{`
          .zero {
            display: grid;
            gap: 6px;
            padding: 8px 0 4px;
          }
          .zero-title {
            margin: 0;
            font-size: 14px;
            font-weight: 650;
            color: var(--text-primary);
          }
          .zero-body {
            margin: 0;
            font-size: 13px;
            color: var(--text-muted);
            max-width: 42ch;
          }
        `}</style>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Performance calendar" interactive={Boolean(drill)}>
      <div className="cal">
        <div className="nav">
          <button
            type="button"
            className="nav-btn"
            disabled={!canPrev}
            aria-label="Previous month"
            onClick={() => setCursor((c) => shiftYearMonth(c.year, c.month, -1))}
          >
            ‹
          </button>
          <div className="month-block">
            <h3 className="month-title">{formatMonthTitle(cursor.year, cursor.month)}</h3>
            {drill && tradedInMonth > 0 ? (
              <button type="button" className="month-link" onClick={openMonth}>
                View {formatSampleSize(tradesInMonth)} this month →
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className="nav-btn"
            disabled={!canNext}
            aria-label="Next month"
            onClick={() => setCursor((c) => shiftYearMonth(c.year, c.month, 1))}
          >
            ›
          </button>
        </div>

        <p className="sub">
          {tradedInMonth === 0
            ? "No trades in this month for the current filter."
            : `${tradedInMonth} trading day${tradedInMonth === 1 ? "" : "s"} in view · click a day to investigate`}
        </p>

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
            const selected = selectedDate === cell.date;
            const label = traded
              ? `${formatDrillDayLabel(cell.date)}. ${formatSampleSize(day!.n)}. ${
                  value != null ? (value > 0 ? "Positive" : value < 0 ? "Negative" : "Flat") : ""
                } ${value != null ? (day!.r != null ? formatR(value) : money(value, currency)) : ""}. ${
                  drill ? "Activate to view trades." : ""
                }`
              : `${formatDrillDayLabel(cell.date)}. No trades.`;

            return (
              <button
                key={cell.date}
                type="button"
                role="gridcell"
                className={`cell day ${traded ? `traded ${tone}` : "empty"}${selected ? " selected" : ""}`}
                style={
                  traded && tone !== "flat"
                    ? {
                        background: `color-mix(in srgb, var(--${tone === "pos" ? "pos" : "neg"}) ${Math.round(
                          intensity * 100,
                        )}%, var(--surface))`,
                      }
                    : undefined
                }
                disabled={!traded || !drill}
                aria-label={label}
                aria-pressed={selected}
                title={traded && day ? dayTooltip(day, currency) : formatDrillDayLabel(cell.date)}
                onClick={() => day && openDay(day)}
              >
                <span className="dom">{cell.dayOfMonth}</span>
                {traded && value != null ? (
                  <span className={`val ${tone}`}>
                    {day!.r != null ? `${value > 0 ? "+" : ""}${num(value, 2)}R` : money(value, currency)}
                  </span>
                ) : null}
                {traded && day && day.n > 1 ? <span className="n">{formatSampleSize(day.n)}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="legend" aria-hidden>
          <span className="leg-label">Loss</span>
          <span className="leg-track">
            <span className="leg-neg" />
            <span className="leg-mid" />
            <span className="leg-pos" />
          </span>
          <span className="leg-label">Profit</span>
        </div>
      </div>

      <style jsx>{`
        .cal {
          display: grid;
          gap: 12px;
        }
        .nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .month-block {
          display: grid;
          gap: 4px;
          justify-items: center;
          text-align: center;
        }
        .month-title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-primary);
        }
        .month-link {
          border: 0;
          background: transparent;
          color: var(--accent-text, var(--accent));
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          padding: 0;
          font-family: inherit;
        }
        .month-link:hover {
          text-decoration: underline;
        }
        .month-link:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
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
        .sub {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 4px;
        }
        .dow {
          text-align: center;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
          padding: 4px 0;
        }
        .cell {
          min-height: 64px;
          border-radius: 8px;
          border: 1px solid transparent;
          padding: 6px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          text-align: left;
          font: inherit;
          color: inherit;
        }
        .pad {
          background: transparent;
          min-height: 48px;
        }
        .empty {
          background: color-mix(in srgb, var(--surface-2) 55%, transparent);
          border-color: color-mix(in srgb, var(--border) 70%, transparent);
        }
        .traded {
          border-color: var(--border);
          cursor: pointer;
        }
        .traded:disabled {
          cursor: default;
        }
        .traded:not(:disabled):hover {
          border-color: var(--accent);
        }
        .traded:not(:disabled):focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
        .selected {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 1px var(--accent);
        }
        .dom {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }
        .traded .dom {
          color: var(--text-secondary);
        }
        .val {
          font-size: 11px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          line-height: 1.2;
        }
        .val.pos {
          color: var(--pos);
        }
        .val.neg {
          color: var(--neg);
        }
        .val.flat {
          color: var(--text-muted);
        }
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
        }
        .leg-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .leg-track {
          display: flex;
          width: 120px;
          height: 6px;
          border-radius: 999px;
          overflow: hidden;
        }
        .leg-neg {
          flex: 1;
          background: var(--neg);
          opacity: 0.65;
        }
        .leg-mid {
          flex: 0.4;
          background: var(--surface-2);
        }
        .leg-pos {
          flex: 1;
          background: var(--pos);
          opacity: 0.65;
        }
        @media (max-width: 720px) {
          .cell {
            min-height: 48px;
            padding: 4px;
          }
          .val {
            font-size: 10px;
          }
          .n {
            display: none;
          }
        }
      `}</style>
    </ChartCard>
  );
}

/** Dispatch from snapshot cards to jump the calendar + open the day drawer. */
export function jumpCalendarToDay(date: string) {
  window.dispatchEvent(new CustomEvent("traderos-calendar-jump", { detail: { date } }));
}
