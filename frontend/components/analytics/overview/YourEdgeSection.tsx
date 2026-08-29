"use client";

import { useMemo, useState } from "react";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InsufficientSample } from "@/components/analytics/primitives/InsufficientSample";
import { HorizontalBars, MetricToggle } from "@/components/analytics/Charts";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard, GroupRow, MetricKey } from "@/lib/analytics";
import {
  generateInstrumentInsight,
  generateSessionInsight,
  generateSetupInsight,
} from "@/lib/analytics/insights/generators";
import { getAnalyticsDefinition } from "@/lib/analytics/registry";
import {
  getInstrumentPerformance,
  getSessionPerformance,
  getSetupPerformance,
} from "@/lib/analytics/view-models";
import type { AnalyticsInsight } from "@/lib/analytics/types";
import { sessionLabel } from "@/lib/format";

type EdgeDimension = "instrument" | "setup" | "session";

const REGISTRY_ID: Record<EdgeDimension, string> = {
  instrument: "instrument_performance",
  setup: "setup_performance",
  session: "session_performance",
};

function EdgeChart({
  analyticsId,
  rows,
  dimension,
  labelFn,
  setupIdForName,
  insight,
}: {
  analyticsId: string;
  rows: GroupRow[];
  dimension: EdgeDimension;
  labelFn?: (k: string) => string;
  setupIdForName?: (name: string) => string | undefined;
  insight: AnalyticsInsight | null;
}) {
  const def = getAnalyticsDefinition(analyticsId);
  const [metric, setMetric] = useState<MetricKey>("expectancy_r");
  const drill = useOptionalAnalyticsDrilldown();
  const filtered = rows.filter((r) => r.n > 0).slice(0, 8);
  const groupN = filtered.reduce((sum, r) => sum + r.n, 0);
  const title = def?.title ?? analyticsId;

  function handleRowClick(row: GroupRow) {
    if (!drill) return;
    const label = labelFn ? labelFn(row.key) : row.key;
    if (dimension === "session") {
      drill.applyPatch({ session: row.key }, label);
    } else if (dimension === "setup") {
      const id = setupIdForName?.(row.key);
      if (id) drill.applyPatch({ setup_id: id }, label);
    } else {
      drill.applyPatch({ symbol: row.key }, label);
    }
    drill.openTrades(`${title}: ${label}`);
  }

  return (
    <ChartCard
      title={title}
      question={def?.primaryQuestion}
      tier={def?.tier}
      sampleSize={groupN}
      actions={<MetricToggle value={metric} onChange={setMetric} />}
      subtitle="Expectancy estimates average outcome per trade in this group."
      insight={insight}
      interactive
    >
      <InsufficientSample n={groupN} context={`ranking ${title.toLowerCase()}`} />
      {filtered.length > 0 ? (
        <HorizontalBars rows={filtered} metric={metric} labelFn={labelFn} onRowClick={drill ? handleRowClick : undefined} />
      ) : (
        <p className="empty">No trades in this group for the selected filters.</p>
      )}
      <style jsx>{`
        .empty {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
        }
      `}</style>
    </ChartCard>
  );
}

export function YourEdgeSection({ data }: { data: AnalyticsDashboard }) {
  const setupIdForName = (name: string) => data.filters.options?.setups.find((s) => s.name === name)?.id;

  const instrumentVm = useMemo(() => getInstrumentPerformance(data), [data]);
  const setupVm = useMemo(() => getSetupPerformance(data), [data]);
  const sessionVm = useMemo(() => getSessionPerformance(data), [data]);

  const instrumentRows: GroupRow[] = useMemo(
    () =>
      instrumentVm.map((r) => ({
        key: r.key,
        n: r.trades,
        net_pnl: String(r.netPnl),
        win_rate: r.winRate !== null ? String(r.winRate) : null,
        profit_factor: r.profitFactor !== null ? String(r.profitFactor) : null,
        expectancy_r: r.expectancy !== null ? String(r.expectancy) : null,
        average_r: r.averageR !== null ? String(r.averageR) : null,
        insight: null,
        evidence: { n: r.trades, level: "LOW", label: "", reason: "" },
      })),
    [instrumentVm],
  );

  const instrumentInsight = useMemo(() => generateInstrumentInsight(instrumentVm), [instrumentVm]);
  const setupInsight = useMemo(() => generateSetupInsight(setupVm), [setupVm]);
  const sessionInsight = useMemo(() => generateSessionInsight(sessionVm), [sessionVm]);

  return (
    <section className="section">
      <h2 className="section-title">Your edge</h2>
      <p className="section-lead">Where your strongest observed results come from in this sample.</p>

      <EdgeChart
        analyticsId={REGISTRY_ID.instrument}
        rows={instrumentRows}
        dimension="instrument"
        insight={instrumentInsight}
      />
      <EdgeChart
        analyticsId={REGISTRY_ID.setup}
        rows={data.setups}
        dimension="setup"
        setupIdForName={setupIdForName}
        insight={setupInsight}
      />
      <EdgeChart
        analyticsId={REGISTRY_ID.session}
        rows={data.sessions}
        dimension="session"
        labelFn={sessionLabel}
        insight={sessionInsight}
      />

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
      `}</style>
    </section>
  );
}
