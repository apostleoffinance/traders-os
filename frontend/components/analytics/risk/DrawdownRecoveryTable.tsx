"use client";

import { Panel } from "@/components/ui";
import { ResearchTable } from "@/components/trader/tables/ResearchTable";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { money } from "@/lib/format";
import { useMemo } from "react";

type RecoveryRow = {
  drawdown: number;
  start: string;
  recovery: string | null;
  depth: string;
  duration_days: number;
};

/** Drawdown recovery table — deep dive research on Risk tab. */
export function DrawdownRecoveryTable({ data }: { data: AnalyticsDashboard }) {
  const eq = data.lab?.equity;
  const drill = useOptionalAnalyticsDrilldown();
  const currency = data.account.currency;
  const recovered = useMemo(() => (eq?.drawdown.recovery_table ?? []) as RecoveryRow[], [eq]);

  const columns = useMemo(
    () => [
      { id: "drawdown", header: "#", accessor: (r: RecoveryRow) => r.drawdown, numeric: true },
      { id: "start", header: "Start", accessor: (r: RecoveryRow) => r.start.slice(0, 10) },
      {
        id: "recovery",
        header: "Recovery",
        accessor: (r: RecoveryRow) => r.recovery?.slice(0, 10) ?? "—",
      },
      {
        id: "depth",
        header: "Depth",
        accessor: (r: RecoveryRow) => money(r.depth, currency),
        numeric: true,
      },
      { id: "days", header: "Days", accessor: (r: RecoveryRow) => r.duration_days, numeric: true },
    ],
    [currency],
  );

  if (!eq) return null;

  function handleRecoveryClick(row: RecoveryRow) {
    if (!drill || !row.recovery) return;
    const from = row.start.slice(0, 10);
    const to = row.recovery.slice(0, 10);
    // Keep the trader’s period filters; only open the trades drawer.
    drill.openTrades(`Drawdown recovery · ${from} → ${to}`);
  }

  return (
    <Panel title="Drawdown recoveries">
      <ResearchTable
        rows={recovered}
        columns={columns}
        getRowId={(r) => String(r.drawdown)}
        onRowClick={drill ? handleRecoveryClick : undefined}
        emptyMessage="No completed drawdown recoveries in this sample."
        caption="Drawdown recovery episodes"
      />
      {drill && recovered.length > 0 ? (
        <p className="muted">Click a row to filter analytics to that drawdown episode.</p>
      ) : null}
      <style jsx>{`
        .muted {
          font-size: 13px;
          margin-top: 8px;
          color: var(--text-muted);
        }
      `}</style>
    </Panel>
  );
}
