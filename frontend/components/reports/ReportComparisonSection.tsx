"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";

type CompRow = {
  metric: string;
  current: string | null;
  previous: string | null;
  absolute: string | null;
  pct: string | null;
  direction: string | null;
  benefit: string | null;
};

export function ReportComparisonSection({
  comparison,
  reportType,
}: {
  comparison: Record<string, unknown>;
  reportType: string;
}) {
  const rows = (comparison.rows ?? []) as CompRow[];
  const available = comparison.available as boolean | undefined;
  const title = reportType === "yearly" ? "Performance evolution" : "Period comparison";

  if (!available) {
    return (
      <>
        <h2 className="section-title">{title}</h2>
        <p className="muted">No previous period data for comparison.</p>
      </>
    );
  }

  return (
    <>
      <h2 className="section-title">{title}</h2>
      <p className="lede">{String(comparison.disclaimer ?? "")}</p>
      <ChartCard title={`${comparison.label ?? "Current vs previous"}`}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Current</th>
              <th>Previous</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.metric}>
                <td>{r.metric}</td>
                <td>{r.current ?? "—"}</td>
                <td>{r.previous ?? "—"}</td>
                <td className={r.benefit === "positive" ? "pos" : r.benefit === "negative" ? "neg" : ""}>
                  {r.absolute ?? "—"}
                  {r.pct ? ` (${r.pct}%)` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ChartCard>
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 8px;
        }
        .lede {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 16px;
        }
        .muted {
          color: var(--muted);
        }
        .tbl {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th,
        td {
          text-align: left;
          padding: 8px 10px;
          border-bottom: 1px solid var(--border);
        }
        th {
          font-size: 11px;
          text-transform: uppercase;
          color: var(--muted);
        }
        .pos {
          color: var(--pos);
        }
        .neg {
          color: var(--neg);
        }
      `}</style>
    </>
  );
}
