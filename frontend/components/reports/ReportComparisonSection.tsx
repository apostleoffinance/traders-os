"use client";

import { ChartCard } from "@/components/trader";
import { ReportTable } from "@/components/trader/tables/ResearchTable";
import { useMemo } from "react";

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

  const columns = useMemo(
    () => [
      { id: "metric", header: "Metric", accessor: (r: CompRow) => r.metric },
      { id: "current", header: "Current", accessor: (r: CompRow) => r.current ?? "—" },
      { id: "previous", header: "Previous", accessor: (r: CompRow) => r.previous ?? "—" },
      {
        id: "change",
        header: "Change",
        accessor: (r: CompRow) => `${r.absolute ?? "—"}${r.pct ? ` (${r.pct}%)` : ""}`,
        cell: (v: string | number | null | undefined, r: CompRow) => (
          <span className={r.benefit === "positive" ? "pos" : r.benefit === "negative" ? "neg" : ""}>{v}</span>
        ),
      },
    ],
    [],
  );

  if (!available) {
    return (
      <>
        <p className="muted">No previous period data for comparison.</p>
        <style jsx>{`
          .muted {
            color: var(--muted);
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <p className="lede">{String(comparison.disclaimer ?? "")}</p>
      <ChartCard title={`${comparison.label ?? "Current vs previous"}`}>
        <ReportTable rows={rows} columns={columns} getRowId={(r) => r.metric} caption={title} />
      </ChartCard>
      <style jsx>{`
        .lede {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 16px;
        }
        :global(.pos) {
          color: var(--success);
        }
        :global(.neg) {
          color: var(--danger);
        }
      `}</style>
    </>
  );
}
