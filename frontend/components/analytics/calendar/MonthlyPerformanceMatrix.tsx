"use client";

import { useMemo } from "react";
import { useLiveChart } from "@/components/analytics/Charts";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { filterForDateRange, formatDrillMonthLabel } from "@/lib/analytics-drilldown";
import {
  MONTH_LABELS,
  heatColor,
  monthRangeBounds,
  type MonthCell,
} from "@/lib/analytics/calendar-view";
import type { CalendarViewModel } from "@/lib/analytics/calendarViewModel";
import { signed } from "@/lib/format";

/** Compact year × month matrix — primary monthly visualization. */
export function MonthlyPerformanceMatrix({ model }: { model: CalendarViewModel }) {
  const drill = useOptionalAnalyticsDrilldown();
  const { resolved } = useLiveChart();
  const { monthlyMatrix: matrix, monthlyCells } = model;

  const posRgb = resolved === "dark" ? "45,212,168" : "13,159,110";
  const negRgb = resolved === "dark" ? "240,113,120" : "212,83,90";

  const activeCount = useMemo(() => monthlyCells.filter((c) => c.n > 0).length, [monthlyCells]);

  if (activeCount === 0) {
    return (
      <section className="matrix-wrap" aria-labelledby="matrix-title">
        <h2 id="matrix-title">Monthly performance</h2>
        <p className="empty">No monthly results in this period.</p>
        <style jsx>{wrapStyles}</style>
      </section>
    );
  }

  return (
    <section className="matrix-wrap" aria-labelledby="matrix-title">
      <header>
        <h2 id="matrix-title">Monthly performance</h2>
        <p className="sub">Net R by month — click a month to investigate.</p>
      </header>

      <div className="scroll">
        <div className="matrix" role="grid" aria-label="Monthly performance by year">
          <div className="corner" />
          {MONTH_LABELS.map((label) => (
            <div key={label} className="col-h">
              {label}
            </div>
          ))}
          {matrix.years.map((year) => (
            <div key={year} className="year-row" role="row">
              <div className="row-h">{year}</div>
              {Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                const key = `${year}-${String(month).padStart(2, "0")}`;
                const cell = matrix.byKey.get(key);
                if (!cell || cell.n === 0) {
                  return <div key={key} className="cell empty" role="gridcell" />;
                }
                return (
                  <MonthCellButton
                    key={key}
                    cell={cell}
                    maxAbs={matrix.maxAbsR}
                    posRgb={posRgb}
                    negRgb={negRgb}
                    onOpen={() => {
                      if (!drill) return;
                      const { from, to } = monthRangeBounds(key);
                      const label = formatDrillMonthLabel(key);
                      drill.applyPatch(filterForDateRange(from, to), label);
                      drill.openTrades(`Trades in ${label}`);
                    }}
                    canOpen={Boolean(drill)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <MonthDetailList cells={monthlyCells} onOpenMonth={(key) => {
        if (!drill) return;
        const { from, to } = monthRangeBounds(key);
        const label = formatDrillMonthLabel(key);
        drill.applyPatch(filterForDateRange(from, to), label);
        drill.openTrades(`Trades in ${label}`);
      }} canOpen={Boolean(drill)} />

      <style jsx>{wrapStyles}</style>
    </section>
  );
}

function MonthCellButton({
  cell,
  maxAbs,
  posRgb,
  negRgb,
  onOpen,
  canOpen,
}: {
  cell: MonthCell;
  maxAbs: number;
  posRgb: string;
  negRgb: string;
  onOpen: () => void;
  canOpen: boolean;
}) {
  const value = cell.r ?? cell.netPnl;
  const label = cell.r != null ? `${signed(cell.r)}R` : signed(cell.netPnl);
  return (
    <button
      type="button"
      className="cell"
      role="gridcell"
      style={{ background: heatColor(value, maxAbs, posRgb, negRgb) }}
      title={`${formatDrillMonthLabel(cell.key)} · ${label} · ${cell.n} trades`}
      aria-label={`${formatDrillMonthLabel(cell.key)}. ${label}. ${cell.n} trades.${canOpen ? " Activate to view trades." : ""}`}
      onClick={canOpen ? onOpen : undefined}
      disabled={!canOpen}
    >
      <span className="r">{cell.r != null ? signed(cell.r) : "·"}</span>
      <span className="n">{cell.n}</span>
      <style jsx>{`
        .cell {
          min-height: 44px;
          border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
          border-radius: 6px;
          padding: 4px;
          display: grid;
          gap: 1px;
          align-content: center;
          justify-items: center;
          cursor: pointer;
          font: inherit;
          color: var(--text-primary);
        }
        .cell:disabled {
          cursor: default;
        }
        .cell:not(:disabled):hover {
          outline: 1px solid var(--accent);
        }
        .cell:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
        .r {
          font-size: 11px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
        }
        .n {
          font-size: 9px;
          color: var(--text-muted);
          font-weight: 600;
        }
      `}</style>
    </button>
  );
}

function MonthDetailList({
  cells,
  onOpenMonth,
  canOpen,
}: {
  cells: MonthCell[];
  onOpenMonth: (key: string) => void;
  canOpen: boolean;
}) {
  const rows = [...cells].filter((c) => c.n > 0).sort((a, b) => b.key.localeCompare(a.key));
  if (!rows.length) return null;

  return (
    <ul className="detail">
      {rows.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            className="row"
            onClick={() => canOpen && onOpenMonth(c.key)}
            disabled={!canOpen}
          >
            <span className="m">{formatDrillMonthLabel(c.key)}</span>
            <span className={`r ${(c.r ?? c.netPnl) >= 0 ? "pos" : "neg"}`}>
              {c.r != null ? `${signed(c.r)}R` : signed(c.netPnl)}
            </span>
            <span className="meta">
              {c.n} trade{c.n === 1 ? "" : "s"}
              {c.winRate != null ? ` · ${Math.round(c.winRate)}% win` : ""}
            </span>
          </button>
        </li>
      ))}
      <style jsx>{`
        .detail {
          list-style: none;
          margin: 4px 0 0;
          padding: 0;
          display: grid;
          gap: 4px;
        }
        .row {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(90px, 1fr) auto auto;
          gap: 10px;
          align-items: center;
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
          font: inherit;
          color: inherit;
          cursor: pointer;
          text-align: left;
        }
        .row:disabled {
          cursor: default;
        }
        .row:not(:disabled):hover {
          border-color: var(--accent);
        }
        .row:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .m {
          font-size: 13px;
          font-weight: 650;
        }
        .r {
          font-size: 13px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
        }
        .r.pos { color: var(--pos); }
        .r.neg { color: var(--neg); }
        .meta {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
          justify-self: end;
        }
        @media (max-width: 560px) {
          .row {
            grid-template-columns: 1fr auto;
            grid-template-rows: auto auto;
          }
          .meta {
            grid-column: 1 / -1;
            justify-self: start;
          }
        }
      `}</style>
    </ul>
  );
}

const wrapStyles = `
  .matrix-wrap {
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
  .scroll {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .matrix {
    display: grid;
    grid-template-columns: 52px repeat(12, minmax(44px, 1fr));
    gap: 4px;
    min-width: 640px;
    align-items: center;
  }
  .corner { min-height: 1px; }
  .col-h {
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
  }
  .year-row {
    display: contents;
  }
  .row-h {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-secondary);
  }
  .cell.empty {
    min-height: 44px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--surface-2) 50%, transparent);
  }
`;
