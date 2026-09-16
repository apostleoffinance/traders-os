"use client";

import { useMemo } from "react";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard } from "@/lib/analytics";
import {
  getInstrumentPerformance,
  getSessionPerformance,
  getSetupPerformance,
  type GroupPerformanceRow,
} from "@/lib/analytics/view-models";
import { EdgeCategoryPanel } from "./EdgeCategoryPanel";

/** Overview Edge Snapshot — instruments / setups / sessions as one decision surface. */
export function EdgeSnapshot({ data }: { data: AnalyticsDashboard }) {
  const drill = useOptionalAnalyticsDrilldown();
  const setupIdForName = (name: string) => data.filters.options?.setups.find((s) => s.name === name)?.id;

  const instruments = useMemo(() => getInstrumentPerformance(data), [data]);
  const setups = useMemo(() => getSetupPerformance(data), [data]);
  const sessions = useMemo(() => getSessionPerformance(data), [data]);

  function selectInstrument(row: GroupPerformanceRow) {
    if (!drill) return;
    drill.applyPatch({ symbol: row.key }, row.label);
    drill.openTrades(`Instruments: ${row.label}`);
  }

  function selectSetup(row: GroupPerformanceRow) {
    if (!drill) return;
    const id = setupIdForName(row.key);
    if (id) drill.applyPatch({ setup_id: id }, row.label);
    drill.openTrades(`Setups: ${row.label}`);
  }

  function selectSession(row: GroupPerformanceRow) {
    if (!drill) return;
    drill.applyPatch({ session: row.key }, row.label);
    drill.openTrades(`Sessions: ${row.label}`);
  }

  return (
    <section className="edge-snap" aria-labelledby="edge-snap-title">
      <header className="intro">
        <h2 id="edge-snap-title" className="title">
          Edge Snapshot
        </h2>
        <p className="lede">Where your trading is currently performing best.</p>
      </header>

      <div className="grid">
        <EdgeCategoryPanel
          title="Instruments"
          subtitle="Most traded instruments"
          entitySingular="instrument"
          entityPlural="instruments"
          rows={instruments}
          mode="share"
          emptyHint="No instrument data yet. Close trades with a symbol to see which markets are working."
          onSelect={drill ? selectInstrument : undefined}
        />
        <EdgeCategoryPanel
          title="Setups"
          subtitle="Your setup performance"
          entitySingular="setup"
          entityPlural="setups"
          rows={setups}
          mode="expectancy"
          emptyHint="No setup data yet. Tag trades with a setup to see which conditions are working best."
          onSelect={drill ? selectSetup : undefined}
        />
        <EdgeCategoryPanel
          title="Sessions"
          subtitle="Performance by trading session"
          entitySingular="session"
          entityPlural="sessions"
          rows={sessions}
          mode="expectancy"
          emptyHint="No session data yet. Session tags appear once closed trades include session metadata."
          onSelect={drill ? selectSession : undefined}
        />
      </div>

      <style jsx>{`
        .edge-snap {
          display: grid;
          gap: 12px;
          min-width: 0;
        }
        .intro {
          display: grid;
          gap: 2px;
        }
        .title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        .lede {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
          max-width: 48ch;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 720px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
