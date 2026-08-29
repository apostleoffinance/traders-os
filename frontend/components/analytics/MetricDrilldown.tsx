"use client";

import type { AnalyticsDashboard } from "@/lib/analytics";
import { num, sessionLabel } from "@/lib/format";
import { Panel } from "@/components/ui";

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
  profit_factor: "Profit factor explained",
  average_r: "Average R explained",
};

export function MetricDrilldown({ open, metric, data, onClose }: Props) {
  if (!open || !metric) return null;
  const overall = data.overview;
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
        <Panel title="By session">
          <table>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.key}>
                  <td>{sessionLabel(s.key)}</td>
                  <td className="mono">{formatMetric(metric, s)}</td>
                  <td className="muted">n={s.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title="By setup">
          <table>
            <tbody>
              {data.setups.slice(0, 8).map((s) => (
                <tr key={s.key}>
                  <td>{s.key}</td>
                  <td className="mono">{formatMetric(metric, s)}</td>
                  <td className="muted">n={s.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
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
          width: min(440px, 100%);
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
        table {
          width: 100%;
          border-collapse: collapse;
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
    </div>
  );
}

function formatMetric(metric: DrillMetric, row: { win_rate: string | null; expectancy_r: string | null; profit_factor: string | null; average_r: string | null }): string {
  if (metric === "win_rate") return row.win_rate ? `${num(row.win_rate, 1)}%` : "—";
  if (metric === "expectancy_r") return row.expectancy_r ? `${row.expectancy_r}R` : "—";
  if (metric === "profit_factor") return row.profit_factor ? num(row.profit_factor) : "—";
  return row.average_r ? `${row.average_r}R` : "—";
}
