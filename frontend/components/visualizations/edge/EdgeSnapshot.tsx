"use client";

import { useMemo } from "react";
import { RankList, type RankListRow } from "@/components/trader";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard } from "@/lib/analytics";
import {
  getInstrumentPerformance,
  getSessionPerformance,
  getSetupPerformance,
} from "@/lib/analytics/view-models";
import { sessionLabel } from "@/lib/format";

/** Overview edge ranks — top 3 only (full boards live in Edge Explorer). */
export function EdgeSnapshot({ data }: { data: AnalyticsDashboard }) {
  const drill = useOptionalAnalyticsDrilldown();
  const setupIdForName = (name: string) => data.filters.options?.setups.find((s) => s.name === name)?.id;

  const instruments = useMemo(() => getInstrumentPerformance(data), [data]);
  const setups = useMemo(() => getSetupPerformance(data), [data]);
  const sessions = useMemo(() => getSessionPerformance(data), [data]);

  const instrumentRows: RankListRow[] = useMemo(
    () =>
      [...instruments]
        .sort((a, b) => (b.expectancy ?? -Infinity) - (a.expectancy ?? -Infinity))
        .map((r) => ({
          key: r.key,
          label: r.label,
          expectancy: r.expectancy,
          winRate: r.winRate,
          trades: r.trades,
          netPnl: r.netPnl,
        })),
    [instruments],
  );

  const setupRows: RankListRow[] = useMemo(
    () =>
      [...setups]
        .sort((a, b) => (b.expectancy ?? -Infinity) - (a.expectancy ?? -Infinity))
        .map((r) => ({
          key: r.key,
          label: r.label,
          expectancy: r.expectancy,
          winRate: r.winRate,
          trades: r.trades,
          netPnl: r.netPnl,
        })),
    [setups],
  );

  const sessionRows: RankListRow[] = useMemo(
    () =>
      [...sessions]
        .sort((a, b) => (b.expectancy ?? -Infinity) - (a.expectancy ?? -Infinity))
        .map((r) => ({
          key: r.key,
          label: sessionLabel(r.key),
          expectancy: r.expectancy,
          winRate: r.winRate,
          trades: r.trades,
          netPnl: r.netPnl,
        })),
    [sessions],
  );

  return (
    <section className="section">
      <div className="grid">
        <RankList
          title="Instruments"
          variant="card"
          rows={instrumentRows}
          onSelect={
            drill
              ? (row) => {
                  drill.applyPatch({ symbol: row.key }, row.label);
                  drill.openTrades(`Instruments: ${row.label}`);
                }
              : undefined
          }
        />
        <RankList
          title="Setups"
          variant="card"
          rows={setupRows}
          onSelect={
            drill
              ? (row) => {
                  const id = setupIdForName(row.key);
                  if (id) drill.applyPatch({ setup_id: id }, row.label);
                  drill.openTrades(`Setups: ${row.label}`);
                }
              : undefined
          }
        />
        <RankList
          title="Sessions"
          variant="card"
          rows={sessionRows}
          onSelect={
            drill
              ? (row) => {
                  drill.applyPatch({ session: row.key }, row.label);
                  drill.openTrades(`Sessions: ${row.label}`);
                }
              : undefined
          }
        />
      </div>
      <style jsx>{`
        .section {
          margin-bottom: 8px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 10px;
        }
      `}</style>
    </section>
  );
}
