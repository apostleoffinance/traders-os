"use client";

import { useMemo } from "react";
import { formatDrillMonthLabel } from "@/lib/analytics-drilldown";
import { MONTH_LABELS, type MonthCell } from "@/lib/analytics/calendar-view";
import {
  todayYearMonth,
  type CalendarViewModel,
} from "@/lib/analytics/calendarViewModel";
import { signed } from "@/lib/format";

/**
 * Compact monthly performance — active months as ranked bars + year strip.
 * No period hijacking: the trader’s global filters stay in control.
 */
export function MonthlyPerformanceMatrix({ model }: { model: CalendarViewModel }) {
  const today = todayYearMonth(model.timezone);

  const active = useMemo(() => {
    return [...model.monthlyCells]
      .filter((c) => {
        if (c.n <= 0) return false;
        // Never show months after the current calendar month
        if (c.year > today.year) return false;
        if (c.year === today.year && c.month > today.month) return false;
        return true;
      })
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [model.monthlyCells, today.year, today.month]);

  const maxAbs = useMemo(() => {
    let m = 0;
    for (const c of active) {
      const v = c.r ?? c.netPnl;
      if (Number.isFinite(v)) m = Math.max(m, Math.abs(v));
    }
    return m > 0 ? m : 1;
  }, [active]);

  const year = active[0]?.year ?? today.year;
  const byMonth = useMemo(() => {
    const map = new Map(active.filter((c) => c.year === year).map((c) => [c.month, c]));
    return map;
  }, [active, year]);

  if (!active.length) {
    return (
      <section className="monthly" aria-labelledby="matrix-title">
        <h2 id="matrix-title">Monthly performance</h2>
        <p className="empty">No monthly results in this period.</p>
        <style jsx>{styles}</style>
      </section>
    );
  }

  return (
    <section className="monthly" aria-labelledby="matrix-title">
      <header>
        <h2 id="matrix-title">Monthly performance</h2>
        <p className="sub">Net R by month in your current filter.</p>
      </header>

      {/* Compact year strip — only months in the primary year */}
      <div className="strip" role="list" aria-label={`${year} monthly net R`}>
        <span className="year">{year}</span>
        {MONTH_LABELS.map((label, i) => {
          const month = i + 1;
          const cell = byMonth.get(month);
          const future = year > today.year || (year === today.year && month > today.month);
          if (future) {
            return <div key={label} className="slot muted" aria-hidden />;
          }
          if (!cell || cell.n === 0) {
            return (
              <div key={label} className="slot empty" role="listitem" title={`${label} — no trades`}>
                <span className="m">{label}</span>
              </div>
            );
          }
          const value = cell.r ?? cell.netPnl;
          const tone = value > 0 ? "pos" : value < 0 ? "neg" : "flat";
          const height = Math.max(8, Math.round((Math.abs(value) / maxAbs) * 36));
          return (
            <div
              key={label}
              className={`slot filled ${tone}`}
              role="listitem"
              title={`${formatDrillMonthLabel(cell.key)} · ${cell.r != null ? signed(cell.r) + "R" : signed(cell.netPnl)} · ${cell.n} trades`}
            >
              <span className="bar" style={{ height }} />
              <span className="m">{label}</span>
              <span className="v">{cell.r != null ? signed(cell.r, "") : "·"}</span>
            </div>
          );
        })}
      </div>

      {/* Ranked list of active months */}
      <ul className="list">
        {active.map((c) => (
          <MonthRow key={c.key} cell={c} maxAbs={maxAbs} />
        ))}
      </ul>

      <style jsx>{styles}</style>
    </section>
  );
}

function MonthRow({ cell, maxAbs }: { cell: MonthCell; maxAbs: number }) {
  const value = cell.r ?? cell.netPnl;
  const tone = value > 0 ? "pos" : value < 0 ? "neg" : "flat";
  const width = Math.max(6, Math.round((Math.abs(value) / maxAbs) * 100));

  return (
    <li className="row">
      <div className="meta">
        <span className="name">{formatDrillMonthLabel(cell.key)}</span>
        <span className={`val ${tone}`}>
          {cell.r != null ? `${signed(cell.r)}R` : signed(cell.netPnl)}
          <span className="n">
            {" "}
            · {cell.n} trade{cell.n === 1 ? "" : "s"}
            {cell.winRate != null ? ` · ${Math.round(cell.winRate)}% win` : ""}
          </span>
        </span>
      </div>
      <div className="track" role="img" aria-label={`${formatDrillMonthLabel(cell.key)}: ${signed(value)}`}>
        <div className={`fill ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <style jsx>{`
        .row {
          display: grid;
          gap: 5px;
        }
        .meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: baseline;
        }
        .name {
          font-size: 13px;
          font-weight: 650;
          color: var(--text-primary);
        }
        .val {
          font-size: 12px;
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
        .n {
          font-weight: 600;
          color: var(--text-muted);
          font-family: inherit;
        }
        .track {
          height: 8px;
          border-radius: 4px;
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
    </li>
  );
}

const styles = `
  .monthly {
    display: grid;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
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
  .empty {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }
  .strip {
    display: grid;
    grid-template-columns: 40px repeat(12, minmax(28px, 1fr));
    gap: 4px;
    align-items: end;
    min-height: 64px;
    width: 100%;
  }
  .year {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-secondary);
    align-self: center;
  }
  .slot {
    display: grid;
    gap: 2px;
    justify-items: center;
    min-height: 52px;
    align-content: end;
  }
  .slot.muted {
    opacity: 0.2;
  }
  .slot.empty {
    opacity: 0.45;
  }
  .slot .bar {
    width: 70%;
    max-width: 18px;
    border-radius: 3px 3px 0 0;
    background: var(--accent);
  }
  .slot.pos .bar {
    background: var(--pos);
  }
  .slot.neg .bar {
    background: var(--neg);
  }
  .slot .m {
    font-size: 9px;
    font-weight: 700;
    color: var(--text-muted);
  }
  .slot .v {
    font-size: 9px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    font-family: var(--font-mono), ui-monospace, Menlo, monospace;
    color: var(--text-secondary);
  }
  .slot.pos .v {
    color: var(--pos);
  }
  .slot.neg .v {
    color: var(--neg);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 10px;
  }
  @media (max-width: 700px) {
    .strip {
      overflow-x: auto;
      min-width: 0;
      grid-template-columns: 36px repeat(12, 36px);
      padding-bottom: 4px;
    }
  }
`;
