"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/trader/ChartCard";
import { Empty } from "@/components/analytics/Charts";
import { useLiveChart } from "@/components/analytics/Charts";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { filterForDateRange } from "@/lib/analytics-drilldown";
import type { AnalyticsDashboard } from "@/lib/analytics";
import {
  MONTH_LABELS,
  buildMonthCells,
  buildYearMonthMatrix,
  heatColor,
  monthRangeBounds,
} from "@/lib/analytics/calendar-view";
import { num, signed } from "@/lib/format";

/** Year × month returns heatmap — R when available, else net P&L intensity. */
export function MonthlyReturnsHeatmap({ data }: { data: AnalyticsDashboard }) {
  const t = data.lab?.temporal;
  const drill = useOptionalAnalyticsDrilldown();
  const { resolved } = useLiveChart();

  const model = useMemo(() => {
    if (!t) return null;
    const cells = buildMonthCells(t.monthly.rows, t.calendar.days);
    return { cells, ...buildYearMonthMatrix(cells) };
  }, [t]);

  if (!t) return null;

  const posRgb = resolved === "dark" ? "45,212,168" : "13,159,110";
  const negRgb = resolved === "dark" ? "240,113,120" : "212,83,90";

  return (
    <ChartCard title="Monthly performance" sampleSize={t.monthly.rows.reduce((s, r) => s + r.n, 0)}>
      {!model || model.cells.length === 0 ? (
        <Empty>No monthly results in this period.</Empty>
      ) : (
        <>
          <div className="legend" aria-hidden>
            <span className="swatch neg" />
            <span>−{num(model.maxAbsR, 1)}R</span>
            <span className="track" />
            <span>+{num(model.maxAbsR, 1)}R</span>
            <span className="swatch pos" />
          </div>
          <div className="matrix" role="grid" aria-label="Monthly returns by year">
            <div className="corner" />
            {MONTH_LABELS.map((label) => (
              <div key={label} className="col-h">
                {label}
              </div>
            ))}
            {model.years.map((year) => (
              <div key={year} className="year-row" role="row">
                <div className="row-h">{year}</div>
                {Array.from({ length: 12 }, (_, i) => {
                  const month = i + 1;
                  const key = `${year}-${String(month).padStart(2, "0")}`;
                  const cell = model.byKey.get(key);
                  if (!cell || cell.n === 0) {
                    return <div key={key} className="cell empty" role="gridcell" />;
                  }
                  const value = cell.r ?? cell.netPnl;
                  const label = cell.r != null ? `${signed(cell.r, "R")}` : signed(cell.netPnl);
                  return (
                    <button
                      key={key}
                      type="button"
                      className="cell"
                      role="gridcell"
                      style={{ background: heatColor(value, model.maxAbsR, posRgb, negRgb) }}
                      title={`${key} · ${label} · n=${cell.n}`}
                      onClick={() => {
                        if (!drill) return;
                        const { from, to } = monthRangeBounds(key);
                        drill.applyPatch(filterForDateRange(from, to), key);
                        drill.openTrades(`Trades in ${key}`);
                      }}
                    >
                      <span className={`v num ${value >= 0 ? "pos" : "neg"}`}>
                        {cell.r != null ? signed(cell.r, "R") : signed(cell.netPnl)}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
      <style jsx>{`
        .legend {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: var(--text-muted);
          margin-bottom: 12px;
        }
        .swatch {
          width: 14px;
          height: 10px;
          border-radius: 2px;
        }
        .swatch.pos {
          background: var(--pos);
        }
        .swatch.neg {
          background: var(--neg);
        }
        .track {
          flex: 1;
          max-width: 120px;
          height: 6px;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--neg), var(--surface-2), var(--pos));
        }
        .matrix {
          display: grid;
          grid-template-columns: 48px repeat(12, minmax(0, 1fr));
          gap: 4px;
          align-items: stretch;
        }
        .corner {
          min-height: 20px;
        }
        .col-h {
          text-align: center;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-muted);
          padding-bottom: 4px;
        }
        .year-row {
          display: contents;
        }
        .row-h {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
        }
        .cell {
          border: 1px solid var(--border);
          border-radius: 6px;
          min-height: 44px;
          padding: 6px 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface-2);
          cursor: pointer;
          color: inherit;
        }
        .cell.empty {
          background: transparent;
          border-style: dashed;
          opacity: 0.35;
          cursor: default;
        }
        .cell:not(.empty):hover {
          outline: 2px solid var(--accent);
          outline-offset: 0;
        }
        .v {
          font-size: 11px;
          font-weight: 600;
        }
        .v.pos {
          color: var(--pos);
        }
        .v.neg {
          color: var(--neg);
        }
        @media (max-width: 900px) {
          .matrix {
            overflow-x: auto;
            min-width: 720px;
          }
        }
      `}</style>
    </ChartCard>
  );
}
