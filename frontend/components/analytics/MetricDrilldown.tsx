"use client";

import type { AnalyticsDashboard, GroupRow } from "@/lib/analytics";
import { money, num, sessionLabel } from "@/lib/format";
import { Panel } from "@/components/ui";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useLiveChart } from "@/components/analytics/Charts";

type DrillMetric = "win_rate" | "expectancy_r" | "profit_factor" | "average_r";

type Props = {
  open: boolean;
  metric: DrillMetric | null;
  data: AnalyticsDashboard;
  onClose: () => void;
};

const LABELS: Record<DrillMetric, string> = {
  win_rate: "Win rate explained",
  expectancy_r: "Expectancy explained",
  profit_factor: "Profit factor composition",
  average_r: "Average R explained",
};

export function MetricDrilldown({ open, metric, data, onClose }: Props) {
  const drill = useOptionalAnalyticsDrilldown();
  const { C } = useLiveChart();
  if (!open || !metric) return null;
  const overall = data.overview;
  const wl = data.lab?.performance?.win_loss;
  const currency = data.account.currency;
  const value =
    metric === "win_rate"
      ? overall.win_rate
        ? `${num(overall.win_rate, 1)}%`
        : "—"
      : metric === "expectancy_r"
        ? overall.expectancy_r
          ? `${overall.expectancy_r}R`
          : "—"
        : metric === "profit_factor"
          ? overall.profit_factor
            ? num(overall.profit_factor)
            : "—"
          : overall.average_r
            ? `${overall.average_r}R`
            : "—";

  const pfChart =
    metric === "profit_factor" && wl
      ? {
          grid: { left: 100, right: 24, top: 16, bottom: 24 },
          xAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
          yAxis: { type: "category", data: ["Gross profit", "Gross loss"], inverse: true },
          series: [
            {
              type: "bar",
              data: [
                { value: Number(wl.profit_factor.gross_profit ?? 0), itemStyle: { color: C.pos } },
                { value: Math.abs(Number(wl.profit_factor.gross_loss ?? 0)), itemStyle: { color: C.neg } },
              ],
            },
          ],
        }
      : null;

  return (
    <div className="overlay" role="dialog" aria-modal="true">
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} />
      <div className="sheet">
        <header>
          <h3>{LABELS[metric]}</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="overall">
          Overall <strong>{value}</strong> · n={overall.n_trades}
        </p>

        {metric === "profit_factor" && wl && (
          <Panel title="Gross profit vs gross loss">
            <p className="muted">
              Gross profit {money(wl.profit_factor.gross_profit, currency)} · Gross loss{" "}
              {money(wl.profit_factor.gross_loss, currency)}
            </p>
            {pfChart && <InteractiveChart option={pfChart} height={140} />}
          </Panel>
        )}

        <Panel title="By session">
          <SegmentTable
            metric={metric}
            rows={data.sessions}
            labelFn={sessionLabel}
            onRowClick={drill ? (row) => drillRow(drill, row, sessionLabel(row.key)) : undefined}
          />
        </Panel>
        <Panel title="By setup">
          <SegmentTable
            metric={metric}
            rows={data.setups.slice(0, 12)}
            onRowClick={
              drill
                ? (row) => {
                    const id = data.filters.options?.setups.find((s) => s.name === row.key)?.id;
                    if (id) {
                      drill.applyPatch({ setup_id: id }, row.key);
                      drill.openTrades(`Setup: ${row.key}`);
                    }
                  }
                : undefined
            }
          />
        </Panel>

        {drill && (
          <button type="button" className="view-trades" onClick={() => drill.openTrades(`${LABELS[metric]} — all trades`)}>
            View contributing trades
          </button>
        )}
      </div>
      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 90;
          display: flex;
          justify-content: flex-end;
        }
        .scrim {
          position: absolute;
          inset: 0;
          border: 0;
          background: color-mix(in srgb, var(--bg) 35%, transparent);
          cursor: pointer;
        }
        .sheet {
          position: relative;
          width: min(480px, 100%);
          height: 100%;
          overflow: auto;
          background: var(--bg);
          border-left: 1px solid var(--line-strong);
          padding: 16px 18px 32px;
        }
        header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        h3 {
          margin: 0;
          font-size: 1.1rem;
        }
        header button {
          border: 0;
          background: transparent;
          cursor: pointer;
          color: var(--muted);
        }
        .overall {
          margin: 0 0 16px;
        }
        .muted {
          font-size: 13px;
          margin-bottom: 8px;
        }
        .view-trades {
          margin-top: 16px;
          width: 100%;
          padding: 10px;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: var(--accent-contrast, #fff);
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function drillRow(
  drill: NonNullable<ReturnType<typeof useOptionalAnalyticsDrilldown>>,
  row: GroupRow,
  label: string,
) {
  drill.applyPatch({ session: row.key }, label);
  drill.openTrades(label);
}

function SegmentTable({
  metric,
  rows,
  labelFn,
  onRowClick,
}: {
  metric: DrillMetric;
  rows: GroupRow[];
  labelFn?: (k: string) => string;
  onRowClick?: (row: GroupRow) => void;
}) {
  return (
    <table>
      <tbody>
        {rows.map((s) => (
          <tr key={s.key} className={onRowClick ? "clickable" : ""} onClick={onRowClick ? () => onRowClick(s) : undefined}>
            <td>{labelFn ? labelFn(s.key) : s.key}</td>
            <td className="mono">{formatMetric(metric, s)}</td>
            <td className="muted">n={s.n}</td>
          </tr>
        ))}
      </tbody>
      <style jsx>{`
        table {
          width: 100%;
          border-collapse: collapse;
        }
        tr.clickable {
          cursor: pointer;
        }
        tr.clickable:hover {
          background: var(--surface-2);
        }
        td {
          padding: 8px 0;
          border-bottom: 1px solid var(--line);
        }
        .mono {
          font-family: var(--font-mono), monospace;
          text-align: right;
        }
        .muted {
          text-align: right;
          font-size: 12px;
        }
      `}</style>
    </table>
  );
}

function formatMetric(
  metric: DrillMetric,
  row: { win_rate: string | null; expectancy_r: string | null; profit_factor: string | null; average_r: string | null },
): string {
  if (metric === "win_rate") return row.win_rate ? `${num(row.win_rate, 1)}%` : "—";
  if (metric === "expectancy_r") return row.expectancy_r ? `${row.expectancy_r}R` : "—";
  if (metric === "profit_factor") return row.profit_factor ? num(row.profit_factor) : "—";
  return row.average_r ? `${row.average_r}R` : "—";
}
