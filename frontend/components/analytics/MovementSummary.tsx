"use client";

import { Panel } from "@/components/ui";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { formatMovement } from "@/lib/format";

export function MovementSummary({ data }: { data: AnalyticsDashboard }) {
  const rows = data.lab?.movement?.by_instrument ?? [];
  if (!rows.length) return null;
  return (
    <Panel title="Price movement">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Instrument</th>
              <th>n</th>
              <th>Avg risk</th>
              <th>Avg target</th>
              <th>Avg realized</th>
              <th>Avg MFE</th>
              <th>Capture</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.symbol}-${row.unit}`}>
                <td>
                  <strong>{row.symbol}</strong>
                  <span className="unit">{row.label}</span>
                </td>
                <td className="num">{row.n}</td>
                <td className="num">{formatMovement(row.average_risk, row.label)}</td>
                <td className="num">{formatMovement(row.average_target, row.label)}</td>
                <td className="num">{formatMovement(row.average_realized, row.label)}</td>
                <td className="num">{formatMovement(row.average_mfe, row.label)}</td>
                <td className="num">{row.average_capture_percent == null ? "—" : `${row.average_capture_percent}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">{data.lab?.movement?.note}</p>
      <style jsx>{`
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
        th { color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
        .unit { display: block; color: var(--text-secondary); font-size: 11px; }
        .muted { margin: 10px 0 0; color: var(--text-secondary); font-size: 12px; }
      `}</style>
    </Panel>
  );
}