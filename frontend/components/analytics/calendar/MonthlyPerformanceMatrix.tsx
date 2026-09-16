"use client";

import { useMemo } from "react";
import { formatDrillMonthLabel } from "@/lib/analytics-drilldown";
import { MONTH_LABELS, type MonthCell } from "@/lib/analytics/calendar-view";
import {
  todayYearMonth,
  type CalendarViewModel,
} from "@/lib/analytics/calendarViewModel";
import { jumpCalendarToDay } from "@/components/analytics/calendar/PerformanceCalendar";
import { money, signed } from "@/lib/format";

function cellTone(cell: MonthCell | undefined, future: boolean): "empty" | "future" | "pos" | "neg" | "flat" {
  if (future) return "future";
  if (!cell || cell.n <= 0) return "empty";
  const value = cell.r ?? cell.netPnl;
  if (value > 0) return "pos";
  if (value < 0) return "neg";
  return "flat";
}

/** Soft semantic intensity from magnitude (0.14–0.55). */
function intensity(value: number, maxAbs: number): number {
  if (maxAbs <= 0) return 0.2;
  return 0.14 + Math.min(1, Math.abs(value) / maxAbs) * 0.41;
}

function firstTradedDayInMonth(days: CalendarViewModel["days"], key: string): string | null {
  const hit = days
    .filter((d) => d.n > 0 && d.date.startsWith(key))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  return hit?.date ?? `${key}-01`;
}

function MonthMatrixCell({
  label,
  cell,
  future,
  maxAbs,
  onOpen,
}: {
  label: string;
  cell: MonthCell | undefined;
  future: boolean;
  maxAbs: number;
  onOpen: (cell: MonthCell) => void;
}) {
  const tone = cellTone(cell, future);
  const active = tone === "pos" || tone === "neg" || tone === "flat";
  const value = cell ? (cell.r ?? cell.netPnl) : 0;
  const alpha = active ? intensity(value, maxAbs) : 0;
  const display =
    tone === "future" || tone === "empty"
      ? "—"
      : cell?.r != null
        ? signed(cell.r, "")
        : signed(cell!.netPnl, "");

  const style =
    tone === "pos"
      ? { background: `color-mix(in srgb, var(--pos) ${Math.round(alpha * 100)}%, transparent)` }
      : tone === "neg"
        ? { background: `color-mix(in srgb, var(--neg) ${Math.round(alpha * 100)}%, transparent)` }
        : tone === "flat"
          ? { background: "var(--surface-2)" }
          : undefined;

  const title =
    tone === "future"
      ? undefined
      : tone === "empty"
        ? `${label} — no trades`
        : `${formatDrillMonthLabel(cell!.key)} · ${
            cell!.r != null ? `${signed(cell!.r)}R` : signed(cell!.netPnl)
          } · ${cell!.n} trade${cell!.n === 1 ? "" : "s"}`;

  if (tone === "future") {
    return <div className="cell future" aria-hidden />;
  }

  if (!active) {
    return (
      <div className="cell empty" role="gridcell" title={title} aria-label={`${label}: no trades`}>
        <span className="m">{label}</span>
        <span className="v">—</span>
        <style jsx>{cellStyles}</style>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`cell active ${tone}`}
      role="gridcell"
      style={style}
      title={title}
      onClick={() => cell && onOpen(cell)}
      aria-label={`${label}: ${display}${cell?.r != null ? "R" : ""}, ${cell!.n} trades`}
    >
      <span className="m">{label}</span>
      <span className="v">
        {display}
        {cell?.r != null ? <span className="unit">R</span> : null}
      </span>
      <style jsx>{cellStyles}</style>
    </button>
  );
}

const cellStyles = `
  .cell {
    display: grid;
    gap: 2px;
    justify-items: center;
    align-content: center;
    min-height: 52px;
    min-width: 0;
    padding: 6px 4px;
    border-radius: 8px;
    border: 1px solid transparent;
    box-sizing: border-box;
  }
  .cell.empty {
    background: var(--surface-2);
    opacity: 0.55;
  }
  .cell.future {
    min-height: 52px;
    opacity: 0.15;
  }
  .cell.active {
    cursor: pointer;
    color: inherit;
    font: inherit;
    width: 100%;
    margin: 0;
    transition: border-color 0.12s ease, transform 0.12s ease;
  }
  .cell.active:hover,
  .cell.active:focus-visible {
    border-color: var(--border-strong, var(--border));
    outline: none;
    transform: translateY(-1px);
  }
  .m {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-muted);
  }
  .cell.active .m {
    color: var(--text-secondary);
  }
  .v {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono), ui-monospace, Menlo, monospace;
    color: var(--text-muted);
    line-height: 1.2;
  }
  .cell.pos .v {
    color: var(--pos);
  }
  .cell.neg .v {
    color: var(--neg);
  }
  .cell.flat .v {
    color: var(--text-secondary);
  }
  .unit {
    font-size: 9px;
    margin-left: 1px;
    opacity: 0.85;
  }
`;

function YearRow({
  year,
  byKey,
  maxAbs,
  today,
  onOpen,
  showYearLabel,
}: {
  year: number;
  byKey: Map<string, MonthCell>;
  maxAbs: number;
  today: { year: number; month: number };
  onOpen: (cell: MonthCell) => void;
  showYearLabel: boolean;
}) {
  return (
    <div className="year-block">
      {showYearLabel ? <div className="year-label">{year}</div> : null}
      <div className="cells" role="grid" aria-label={`${year} monthly performance`}>
        {MONTH_LABELS.map((label, i) => {
          const month = i + 1;
          const key = `${year}-${String(month).padStart(2, "0")}`;
          const cell = byKey.get(key);
          const future = year > today.year || (year === today.year && month > today.month);
          return (
            <MonthMatrixCell
              key={key}
              label={label}
              cell={cell}
              future={future}
              maxAbs={maxAbs}
              onOpen={onOpen}
            />
          );
        })}
      </div>
      <style jsx>{`
        .year-block {
          display: grid;
          gap: 8px;
          min-width: 0;
        }
        .year-label {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary);
          letter-spacing: 0.02em;
        }
        .cells {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 4px;
          min-width: 0;
        }
        @media (max-width: 720px) {
          .cells {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}

function ActiveMonthDetail({
  cell,
  maxAbs,
  currency,
  onOpen,
}: {
  cell: MonthCell;
  maxAbs: number;
  currency: string;
  onOpen: (cell: MonthCell) => void;
}) {
  const value = cell.r ?? cell.netPnl;
  const tone = value > 0 ? "pos" : value < 0 ? "neg" : "flat";
  const width = Math.max(6, Math.round((Math.abs(value) / maxAbs) * 100));

  return (
    <button type="button" className="detail" onClick={() => onOpen(cell)}>
      <div className="top">
        <span className="name">{formatDrillMonthLabel(cell.key)}</span>
        <span className={`val ${tone}`}>
          {cell.r != null ? `${signed(cell.r)}R` : signed(cell.netPnl)}
        </span>
      </div>
      <div className="stats">
        <span>
          {cell.n} trade{cell.n === 1 ? "" : "s"}
        </span>
        {cell.winRate != null ? <span>{Math.round(cell.winRate)}% win rate</span> : null}
        <span>{money(cell.netPnl, currency)}</span>
      </div>
      <div className="track" aria-hidden>
        <div className={`fill ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <style jsx>{`
        .detail {
          display: grid;
          gap: 6px;
          width: 100%;
          margin: 0;
          padding: 10px 12px;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          text-align: left;
          cursor: pointer;
          color: inherit;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .detail:hover,
        .detail:focus-visible {
          background: var(--surface-2);
          border-color: var(--border);
          outline: none;
        }
        .top {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: baseline;
        }
        .name {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--text-primary);
        }
        .val {
          font-size: 13px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
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
        .stats {
          display: flex;
          flex-wrap: wrap;
          gap: 6px 12px;
          font-size: 12px;
          color: var(--text-muted);
        }
        .track {
          height: 6px;
          border-radius: 3px;
          background: var(--surface-2);
          overflow: hidden;
        }
        .fill {
          height: 100%;
          border-radius: inherit;
          min-width: 2px;
        }
        .fill.pos {
          background: var(--pos);
        }
        .fill.neg {
          background: var(--neg);
        }
        .fill.flat {
          background: var(--text-muted);
          opacity: 0.45;
        }
      `}</style>
    </button>
  );
}

/**
 * 12-month performance matrix + compact active-month detail.
 * Distinguishes no-trades (—) from zero P&L (0 / flat cell).
 */
export function MonthlyPerformanceMatrix({
  model,
  currency = "USD",
}: {
  model: CalendarViewModel;
  currency?: string;
}) {
  const today = todayYearMonth(model.timezone);
  const { years, byKey, maxAbsR } = model.monthlyMatrix;

  const active = useMemo(() => {
    return [...model.monthlyCells]
      .filter((c) => {
        if (c.n <= 0) return false;
        if (c.year > today.year) return false;
        if (c.year === today.year && c.month > today.month) return false;
        return true;
      })
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [model.monthlyCells, today.year, today.month]);

  const maxAbs = useMemo(() => {
    let m = maxAbsR;
    for (const c of active) {
      const v = c.r ?? c.netPnl;
      if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
    }
    return m > 0 ? m : 1;
  }, [active, maxAbsR]);

  const displayYears = useMemo(() => {
    if (years.length) return years.filter((y) => y <= today.year);
    return [today.year];
  }, [years, today.year]);

  const openMonth = (cell: MonthCell) => {
    const date = firstTradedDayInMonth(model.days, cell.key);
    if (date) jumpCalendarToDay(date);
  };

  if (!model.totalTrades) {
    return (
      <section className="monthly" aria-labelledby="matrix-title">
        <h2 id="matrix-title">Monthly performance</h2>
        <p className="empty">No monthly results in this period.</p>
        <style jsx>{sectionStyles}</style>
      </section>
    );
  }

  return (
    <section className="monthly" aria-labelledby="matrix-title">
      <header className="head">
        <div>
          <h2 id="matrix-title">Monthly performance</h2>
          <p className="sub">Your performance by month.</p>
        </div>
        {displayYears.length === 1 ? (
          <span className="year-chip" aria-hidden>
            {displayYears[0]}
          </span>
        ) : null}
      </header>

      {model.earlyHistory ? (
        <p className="note">Empty months mean no trades — not a flat result.</p>
      ) : null}

      <div className="years">
        {displayYears.map((year) => (
          <YearRow
            key={year}
            year={year}
            byKey={byKey}
            maxAbs={maxAbs}
            today={today}
            onOpen={openMonth}
            showYearLabel={displayYears.length > 1}
          />
        ))}
      </div>

      {active.length > 0 ? (
        <div className="details" aria-label="Active months">
          {active.map((c) => (
            <ActiveMonthDetail
              key={c.key}
              cell={c}
              maxAbs={maxAbs}
              currency={currency}
              onOpen={openMonth}
            />
          ))}
        </div>
      ) : null}

      <style jsx>{sectionStyles}</style>
    </section>
  );
}

const sectionStyles = `
  .monthly {
    display: grid;
    gap: 14px;
    padding: 14px 16px;
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
  }
  h2 {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-primary);
  }
  .sub,
  .empty,
  .note {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted);
    line-height: 1.4;
  }
  .note {
    margin: 0;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--surface-2);
    color: var(--text-secondary);
  }
  .year-chip {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }
  .years {
    display: grid;
    gap: 16px;
    min-width: 0;
  }
  .details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 12px;
    padding-top: 4px;
    border-top: 1px solid var(--border);
  }
  @media (max-width: 640px) {
    .details {
      grid-template-columns: 1fr;
    }
  }
`;
