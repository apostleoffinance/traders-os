"use client";

import { useMemo } from "react";
import type { AnalyticsDashboard, GroupRow } from "@/lib/analytics";
import { ChartCard } from "@/components/trader";
import { HorizontalBars } from "@/components/analytics/Charts";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";

function sortByExpectancy(rows: GroupRow[]): GroupRow[] {
  return [...rows].sort((a, b) => {
    const ae = a.expectancy_r ? Number(a.expectancy_r) : -999;
    const be = b.expectancy_r ? Number(b.expectancy_r) : -999;
    return be - ae;
  });
}

/** Single psychology ranking surface for Behaviour (bubble map stays in deep dive). */
export function BehaviourLab({ data }: { data: AnalyticsDashboard }) {
  const psych = useMemo(() => sortByExpectancy(data.psychology.filter((r) => r.n > 0)), [data.psychology]);
  const drill = useOptionalAnalyticsDrilldown();
  const totalN = psych.reduce((s, r) => s + r.n, 0);

  return (
    <div className="behaviour">
      <ChartCard
        title="Emotions × performance"
        question="Which emotional states show stronger or weaker results?"
        tier="essential"
        sampleSize={totalN}
        subtitle="Ranked by expectancy. Tag pre-trade emotions on journal entries to populate this."
        interactive
      >
        {psych.length === 0 ? (
          <p className="empty">No emotion tags in this sample yet. Add psychology tags when logging trades.</p>
        ) : (
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
        )}
      </ChartCard>

      <style jsx>{`
        .behaviour {
          display: grid;
          gap: 14px;
        }
        .empty {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
