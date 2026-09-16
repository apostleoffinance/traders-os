"use client";

import { useMemo } from "react";
import { RankList, type RankListRow } from "@/components/trader";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard } from "@/lib/analytics";
import {
  generateInstrumentInsight,
  generateSessionInsight,
  generateSetupInsight,
  resolveVizCopy,
} from "@/lib/visualization";
import {
  getInstrumentPerformance,
  getSessionPerformance,
  getSetupPerformance,
} from "@/lib/analytics/view-models";
import { sessionLabel } from "@/lib/format";

/** Overview edge snapshot — top 3 ranks only (full boards live in Edge Explorer). */
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

  const instCopy = resolveVizCopy("instrument_performance");
  const setupCopy = resolveVizCopy("setup_performance");
  const sessionCopy = resolveVizCopy("session_performance");

  return (
    <section className="section">
      <h2 className="section-title">Edge snapshot</h2>
      <p className="section-lead">Top observed results in this sample — open Edge Explorer for the full ranking.</p>
      <div className="grid">
        <RankList
          title={instCopy.title}
          question={instCopy.question}
          rows={instrumentRows}
          insight={generateInstrumentInsight(instruments)}
          onSelect={
            drill
              ? (row) => {
                  drill.applyPatch({ symbol: row.key }, row.label);
                  drill.openTrades(`${instCopy.title}: ${row.label}`);
                }
              : undefined
          }
        />
        <RankList
          title={setupCopy.title}
          question={setupCopy.question}
          rows={setupRows}
          insight={generateSetupInsight(setups)}
          onSelect={
            drill
              ? (row) => {
                  const id = setupIdForName(row.key);
                  if (id) drill.applyPatch({ setup_id: id }, row.label);
                  drill.openTrades(`${setupCopy.title}: ${row.label}`);
                }
              : undefined
          }
        />
        <RankList
          title={sessionCopy.title}
          question={sessionCopy.question}
          rows={sessionRows}
          insight={generateSessionInsight(sessions)}
          onSelect={
            drill
              ? (row) => {
                  drill.applyPatch({ session: row.key }, row.label);
                  drill.openTrades(`${sessionCopy.title}: ${row.label}`);
                }
              : undefined
          }
        />
      </div>
      <style jsx>{`
        .section {
          margin-bottom: 8px;
        }
        .section-title {
          margin: 0 0 4px;
          font-size: 15px;
        }
        .section-lead {
          margin: 0 0 14px;
          font-size: 14px;
          color: var(--text-muted);
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
