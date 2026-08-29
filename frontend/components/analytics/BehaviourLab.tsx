"use client";

import { useMemo } from "react";
import type { AnalyticsDashboard, GroupRow } from "@/lib/analytics";
import { sessionLabel } from "@/lib/format";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { HorizontalBars } from "@/components/analytics/Charts";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";

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
  const drill = useOptionalAnalyticsDrilldown();

  return (
    <div className="behaviour">
      <ChartCard title="Psychology × performance" interactive>
        <HorizontalBars
          rows={psych}
          metric="expectancy_r"
          onRowClick={
            drill
              ? (row) => {
                  drill.applyPatch({ psychology: row.key }, row.key);
                  drill.openTrades(`Psychology: ${row.key}`);
                }
              : undefined
          }
        />
      </ChartCard>

      <ChartCard title="Session behaviour" interactive>
        <HorizontalBars
          rows={sessions}
          metric="expectancy_r"
          labelFn={sessionLabel}
          onRowClick={
            drill
              ? (row) => {
                  drill.applyPatch({ session: row.key }, sessionLabel(row.key));
                  drill.openTrades(`${sessionLabel(row.key)} session`);
                }
              : undefined
          }
        />
      </ChartCard>

      {data.after_losses && data.after_losses.n > 0 && (
        <ChartCard title="After consecutive losses">
          <p>
            Trades taken after 2+ losses: <strong>{data.after_losses.n}</strong> · Expectancy{" "}
            <span className="mono">{data.after_losses.expectancy_r ? `${data.after_losses.expectancy_r}R` : "—"}</span>
          </p>
          <p className="muted small">{data.after_losses.insight}</p>
        </ChartCard>
      )}

      <style jsx>{`
        .behaviour {
          display: grid;
          gap: 14px;
        }
        .small {
          font-size: 13px;
          color: var(--muted);
          margin: 8px 0 0;
        }
        .mono {
          font-family: var(--font-mono), monospace;
        }
      `}</style>
    </div>
  );
}
