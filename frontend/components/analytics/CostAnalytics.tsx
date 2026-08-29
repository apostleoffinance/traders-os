"use client";

import { Panel, Stat } from "@/components/ui";
import { Empty, EvidenceTag, useLiveChart } from "@/components/analytics/Charts";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { money, num } from "@/lib/format";

const WATERFALL_SEGMENTS = ["Gross P&L", "Commission", "Swap", "Net P&L"] as const;

export function CostAnalytics({ data }: { data: AnalyticsDashboard }) {
  const lab = data.lab;
  const currency = data.account.currency;
  const drill = useOptionalAnalyticsDrilldown();
  if (!lab) return null;
  const { commissions: comm, swaps: swap, gross_vs_net: gvn } = lab.costs;
  const { C } = useLiveChart();
  const n = gvn.n;

  const waterfall = {
    tooltip: {
      trigger: "axis",
      formatter: (items: { name: string; value: number }[]) => {
        const row = items[0];
        if (!row) return "";
        return `${row.name}<br/>${money(row.value, currency)}`;
      },
    },
    grid: { left: 48, right: 16, top: 24, bottom: 32 },
    xAxis: { type: "category", data: [...WATERFALL_SEGMENTS] },
    yAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        data: [
          { value: Number(gvn.gross_pnl ?? 0), itemStyle: { color: C.blue }, name: "Gross P&L" },
          { value: Number(gvn.commission ?? 0), itemStyle: { color: C.neg }, name: "Commission" },
          { value: Number(gvn.swap ?? 0), itemStyle: { color: C.amber }, name: "Swap" },
          { value: Number(gvn.net_pnl ?? 0), itemStyle: { color: C.pos }, name: "Net P&L" },
        ],
      },
    ],
  };

  const commByInst = {
    grid: { left: 80, right: 16, top: 16, bottom: 24 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "category", data: comm.by_instrument.map((r) => r.symbol), inverse: true },
    series: [
      {
        type: "bar",
        data: comm.by_instrument.map((r) => ({
          value: Math.abs(Number(r.total)),
          symbol: r.symbol,
        })),
        itemStyle: { color: C.neg },
      },
    ],
  };

  const swapByInst =
    swap.by_instrument.length > 0
      ? {
          grid: { left: 80, right: 16, top: 16, bottom: 24 },
          tooltip: { trigger: "axis" },
          xAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
          yAxis: { type: "category", data: swap.by_instrument.map((r) => r.symbol), inverse: true },
          series: [
            {
              type: "bar",
              data: swap.by_instrument.map((r) => ({
                value: Math.abs(Number(r.total)),
                symbol: r.symbol,
              })),
              itemStyle: { color: C.amber },
            },
          ],
        }
      : null;

  function handleWaterfallClick(segment: string) {
    if (!drill) return;
    if (segment === "Gross P&L") {
      drill.openTrades("Gross P&L breakdown");
      return;
    }
    if (segment === "Commission") {
      drill.openTrades("Commission impact on filtered trades");
      return;
    }
    if (segment === "Swap") {
      drill.openTrades("Swap impact on filtered trades");
      return;
    }
    drill.openTrades("Net P&L trades");
  }

  if (n === 0) {
    return (
      <Panel title="Cost analytics">
        <Empty>{gvn.sample_note ?? "No closed trades."}</Empty>
      </Panel>
    );
  }

  return (
    <>
      <ChartCard title="Gross vs net" sampleSize={n} evidenceLabel={gvn.evidence.label} interactive>
        <div className="kpis">
          <Stat label="Gross P&L" value={money(gvn.gross_pnl, currency)} />
          <Stat label="Commission" value={money(gvn.commission, currency)} />
          <Stat label="Swap" value={money(gvn.swap, currency)} />
          <Stat label="Trading costs" value={money(gvn.total_trading_cost, currency)} />
          <Stat label="Net P&L" value={money(gvn.net_pnl, currency)} />
          <Stat
            label="Cost drag"
            value={gvn.cost_drag_pct ? `${num(gvn.cost_drag_pct, 1)}%` : gvn.cost_drag_note ?? "—"}
          />
        </div>
        <InteractiveChart
          option={waterfall}
          height={260}
          showHint={false}
          onChartClick={(e) => {
            if (e.dataIndex != null) handleWaterfallClick(WATERFALL_SEGMENTS[e.dataIndex]);
          }}
        />
        <p className="muted">{gvn.sign_convention}</p>
      </ChartCard>

      <ChartCard title="Commission" interactive>
        {!comm.data_available && comm.missing_note && <Empty>{comm.missing_note}</Empty>}
        <div className="kpis">
          <Stat label="Total" value={money(comm.total, currency)} />
          <Stat label="Average / trade" value={money(comm.average, currency)} />
          <Stat label="Median" value={money(comm.median, currency)} />
          {comm.pct_of_gross_profit && (
            <Stat label="% of gross profit" value={`${num(comm.pct_of_gross_profit, 1)}%`} />
          )}
        </div>
        {comm.by_instrument.length > 0 && (
          <InteractiveChart
            option={commByInst}
            height={Math.max(180, comm.by_instrument.length * 28 + 48)}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || e.dataIndex == null) return;
              const row = comm.by_instrument[e.dataIndex];
              if (!row) return;
              drill.applyPatch({ symbol: row.symbol }, row.symbol);
              drill.openTrades(`Commission · ${row.symbol}`);
            }}
          />
        )}
      </ChartCard>

      <ChartCard title="Swap" interactive>
        {!swap.data_available && swap.missing_note && <Empty>{swap.missing_note}</Empty>}
        <div className="kpis">
          <Stat label="Net swap" value={money(swap.total, currency)} />
          <Stat label="Positive" value={money(swap.positive, currency)} />
          <Stat label="Negative" value={money(swap.negative, currency)} />
          <Stat label="Avg / trade" value={money(swap.average, currency)} />
        </div>
        {swapByInst && (
          <InteractiveChart
            option={swapByInst}
            height={Math.max(180, swap.by_instrument.length * 28 + 48)}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || e.dataIndex == null) return;
              const row = swap.by_instrument[e.dataIndex];
              if (!row) return;
              drill.applyPatch({ symbol: row.symbol }, row.symbol);
              drill.openTrades(`Swap · ${row.symbol}`);
            }}
          />
        )}
      </ChartCard>

      <style jsx>{`
        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 14px;
          margin-bottom: 12px;
        }
        .muted {
          font-size: 12px;
          color: var(--muted);
        }
      `}</style>
    </>
  );
}
