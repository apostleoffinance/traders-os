"use client";

import { ReportChapter } from "./story/ReportChapter";
import { formatMovement } from "@/lib/format";

export function ReportMovementSection({ movement }: { movement: Record<string, unknown> }) {
  const rows = (movement.by_instrument ?? []) as {
    symbol: string;
    label: string;
    n: number;
    average_risk: string | null;
    average_target: string | null;
    average_realized: string | null;
    average_mfe: string | null;
    average_capture_percent: string | null;
  }[];
  if (!rows.length) return null;
  return (
    <ReportChapter
      id="movement"
      title="Price movement"
      question="How far did trades move in their native instrument unit?"
      takeaway="Movement is grouped by instrument so pips, price units, ticks, and currency values are never averaged together."
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Instrument</th><th>n</th><th>Avg risk</th><th>Avg target</th><th>Avg realized</th><th>Avg MFE</th><th>Capture</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.symbol}-${row.label}`}>
                <td><strong>{row.symbol}</strong><small>{row.label}</small></td>
                <td>{row.n}</td>
                <td>{formatMovement(row.average_risk, row.label)}</td>
                <td>{formatMovement(row.average_target, row.label)}</td>
                <td>{formatMovement(row.average_realized, row.label)}</td>
                <td>{formatMovement(row.average_mfe, row.label)}</td>
                <td>{row.average_capture_percent == null ? "—" : `${row.average_capture_percent}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { padding: 8px 10px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
        th { color: var(--text-secondary); font-size: 11px; text-transform: uppercase; }
        small { display: block; color: var(--text-secondary); }
      `}</style>
    </ReportChapter>
  );
}
