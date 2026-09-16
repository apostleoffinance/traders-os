"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/trader/ChartCard";
import { Empty } from "@/components/analytics/Charts";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { filterForDateRange, formatDrillMonthLabel } from "@/lib/analytics-drilldown";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { buildMonthCells, monthRangeBounds, MONTH_LABELS } from "@/lib/analytics/calendar-view";
import { formatSampleSize } from "@/lib/visualization";
import { money, num, signed, tone } from "@/lib/format";

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const idx = Number(m) - 1;
  const name = MONTH_LABELS[idx] ?? m;
  return `${name} ${y}`;
}

/** Recent months list — P&L (R), trades, win rate bar. */
export function MonthlyBreakdown({ data }: { data: AnalyticsDashboard }) {
  const t = data.lab?.temporal;
  const currency = data.account.currency;
  const drill = useOptionalAnalyticsDrilldown();

  const rows = useMemo(() => {
    if (!t) return [];
    return buildMonthCells(t.monthly.rows, t.calendar.days).sort((a, b) => b.key.localeCompare(a.key));
  }, [t]);

  if (!t) return null;

  return (
    <ChartCard title="Monthly breakdown" sampleSize={rows.reduce((s, r) => s + r.n, 0)}>
      {rows.length === 0 ? (
        <Empty>No months in this filter.</Empty>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Month</th>
              <th>P&L (R)</th>
              <th>Trades</th>
              <th>Win rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const wr = row.winRate ?? 0;
              const rTone = tone(row.r ?? row.netPnl);
              return (
                <tr
                  key={row.key}
                  tabIndex={drill ? 0 : undefined}
                  onClick={() => {
                    if (!drill) return;
                    const { from, to } = monthRangeBounds(row.key);
                    const label = formatDrillMonthLabel(row.key);
                    drill.applyPatch(filterForDateRange(from, to), label);
                    drill.openTrades(`Trades in ${label}`);
                  }}
                  onKeyDown={(e) => {
                    if (!drill || (e.key !== "Enter" && e.key !== " ")) return;
                    e.preventDefault();
                    const { from, to } = monthRangeBounds(row.key);
                    const label = formatDrillMonthLabel(row.key);
                    drill.applyPatch(filterForDateRange(from, to), label);
                    drill.openTrades(`Trades in ${label}`);
                  }}
                >
                  <td>
                    <strong>{monthLabel(row.key)}</strong>
                    <span className="sub muted">{money(row.netPnl, currency)}</span>
                  </td>
                  <td className={`num ${rTone}`}>
                    {row.r != null ? `${signed(num(row.r, 1))}R` : "—"}
                  </td>
                  <td className="num">{formatSampleSize(row.n)}</td>
                  <td>
                    <div className="wr">
                      <span className="num">{row.winRate != null ? `${num(row.winRate, 0)}%` : "—"}</span>
                      <div className="bar" aria-hidden>
                        <div className="fill" style={{ width: `${Math.min(100, Math.max(0, wr))}%` }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <style jsx>{`
        .tbl {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .tbl th {
          text-align: left;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
          padding: 6px 8px;
          border-bottom: 1px solid var(--border);
        }
        .tbl td {
          padding: 10px 8px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
        }
        .tbl tbody tr {
          cursor: pointer;
        }
        .tbl tbody tr:hover td {
          background: var(--surface-2);
        }
        .sub {
          display: block;
          font-size: 11px;
          font-weight: 400;
          margin-top: 2px;
        }
        .wr {
          display: grid;
          gap: 4px;
          min-width: 72px;
        }
        .bar {
          height: 4px;
          border-radius: 999px;
          background: var(--surface-2);
          overflow: hidden;
        }
        .fill {
          height: 100%;
          background: var(--accent);
          border-radius: 999px;
        }
        .muted {
          color: var(--text-muted);
        }
      `}</style>
    </ChartCard>
  );
}
