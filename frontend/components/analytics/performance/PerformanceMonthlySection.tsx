"use client";

import { ChartCard } from "@/components/trader";
import { Empty, useLiveChart } from "@/components/analytics/Charts";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { filterForDateRange } from "@/lib/analytics-drilldown";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { colorForPnl } from "@/lib/chart-colors";
import { money } from "@/lib/format";

/** Monthly P&L bars — Performance owns period results (Calendar keeps the heat grid). */
export function PerformanceMonthlySection({ data }: { data: AnalyticsDashboard }) {
  const rows = data.lab?.temporal?.monthly?.rows ?? [];
  const currency = data.account.currency;
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();

  if (rows.length === 0) return null;

  const chart = {
    grid: { left: 48, right: 16, top: 16, bottom: 48 },
    tooltip: {
      trigger: "axis",
      formatter: (items: { dataIndex: number }[]) => {
        const i = items[0]?.dataIndex ?? 0;
        const r = rows[i];
        if (!r) return "";
        return `${r.month}<br/>Net ${money(r.net_pnl, currency)} · n=${r.n}<br/>WR ${r.win_rate ?? "—"}% · PF ${r.profit_factor ?? "—"}`;
      },
    },
    xAxis: {
      type: "category",
      data: rows.map((r) => r.month),
      axisLabel: { fontSize: 10, rotate: rows.length > 8 ? 35 : 0 },
    },
    yAxis: { type: "value", name: "Net P&L", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        data: rows.map((r) => ({
          value: Number(r.net_pnl),
          itemStyle: { color: colorForPnl(C, r.net_pnl) },
        })),
        label: {
          show: rows.length <= 8,
          position: "top",
          fontSize: 9,
          formatter: (p: { dataIndex: number }) => `n=${rows[p.dataIndex].n}`,
        },
      },
    ],
  };

  return (
    <ChartCard
      title="Monthly performance"
      question="Which months contributed most to my results?"
      tier="essential"
      interactive
      subtitle="Net P&L by month in the filtered sample."
    >
      {rows.length === 0 ? (
        <Empty>No monthly data yet.</Empty>
      ) : (
        <InteractiveChart
          option={chart}
          height={240}
          showHint={false}
          onChartClick={(e) => {
            if (!drill || e.dataIndex == null) return;
            const r = rows[e.dataIndex];
            if (!r?.month) return;
            const [y, m] = r.month.split("-");
            if (y && m) {
              const from = `${y}-${m}-01`;
              const last = new Date(Number(y), Number(m), 0).getDate();
              const to = `${y}-${m}-${String(last).padStart(2, "0")}`;
              drill.applyPatch(filterForDateRange(from, to), r.month);
              drill.openTrades(`Trades in ${r.month}`);
            }
          }}
        />
      )}
    </ChartCard>
  );
}
