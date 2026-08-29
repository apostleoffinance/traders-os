"use client";

import { useMemo } from "react";
import type { AnalyticsDashboard, GroupRow } from "@/lib/analytics";
import { num, sessionLabel } from "@/lib/format";
import { Panel } from "@/components/ui";

function sortByExpectancy(rows: GroupRow[]): GroupRow[] {
  return [...rows].sort((a, b) => {
    const ae = a.expectancy_r ? Number(a.expectancy_r) : -999;
    const be = b.expectancy_r ? Number(b.expectancy_r) : -999;
    return be - ae;
  });
}

export function BehaviourLab({ data }: { data: AnalyticsDashboard }) {
  const psych = useMemo(() => sortByExpectancy(data.psychology), [data.psychology]);
  const sessions = useMemo(() => sortByExpectancy(data.sessions), [data.sessions]);

  return (
    <div className="behaviour">
      <Panel title="Emotional performance">
        <p className="muted intro">How your pre-trade emotional state associates with outcomes. Descriptive only.</p>
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Emotion (before)</th>
              <th>Trades</th>
              <th>Win rate</th>
              <th>Expectancy</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {psych.map((row) => (
              <tr key={row.key} className={rowTone(row)}>
                <td className="cap">{row.key}</td>
                <td>{row.n}</td>
                <td>{row.win_rate ? `${num(row.win_rate, 1)}%` : "—"}</td>
                <td className="mono">{row.expectancy_r ? `${row.expectancy_r}R` : "—"}</td>
                <td className="muted small">{row.evidence.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Session behaviour">
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Trades</th>
              <th>Win rate</th>
              <th>Expectancy</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((row) => (
              <tr key={row.key} className={rowTone(row)}>
                <td>{sessionLabel(row.key)}</td>
                <td>{row.n}</td>
                <td>{row.win_rate ? `${num(row.win_rate, 1)}%` : "—"}</td>
                <td className="mono">{row.expectancy_r ? `${row.expectancy_r}R` : "—"}</td>
                <td className="muted small">{row.evidence.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {data.after_losses && data.after_losses.n > 0 && (
        <Panel title="After consecutive losses">
          <p>
            Trades taken after 2+ losses: <strong>{data.after_losses.n}</strong> · Expectancy{" "}
            <span className="mono">{data.after_losses.expectancy_r ? `${data.after_losses.expectancy_r}R` : "—"}</span>
          </p>
          <p className="muted small">{data.after_losses.insight}</p>
        </Panel>
      )}

      <style jsx>{`
        .intro {
          margin: 0 0 12px;
        }
        .matrix-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .matrix-table th {
          text-align: left;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          padding: 8px 10px;
          border-bottom: 1px solid var(--line-strong);
        }
        .matrix-table td {
          padding: 10px;
          border-bottom: 1px solid var(--line);
        }
        .matrix-table tr.pos td.mono {
          color: var(--accent);
        }
        .matrix-table tr.neg td.mono {
          color: var(--danger);
        }
        .mono {
          font-family: var(--font-mono), monospace;
        }
        .cap {
          text-transform: capitalize;
        }
        .small {
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}

function rowTone(row: GroupRow): string {
  if (row.n < 3 || !row.expectancy_r) return "";
  const e = Number(row.expectancy_r);
  if (e >= 0.2) return "pos";
  if (e <= -0.15) return "neg";
  return "";
}
