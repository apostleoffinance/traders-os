"use client";

import { useMemo, useState } from "react";
import { ChartCard } from "@/components/trader/ChartCard";
import { Empty, useLiveChart } from "@/components/analytics/Charts";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { filterForSingleDay } from "@/lib/analytics-drilldown";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { money, num } from "@/lib/format";

type Metric = "r" | "net_pnl" | "n";

/** Daily performance bars — P&L / R / trade count. */
export function DailyPerformanceBars({ data }: { data: AnalyticsDashboard }) {
  const t = data.lab?.temporal;
  const currency = data.account.currency;
  const drill = useOptionalAnalyticsDrilldown();
  const { C } = useLiveChart();
  const [metric, setMetric] = useState<Metric>("r");

  const days = useMemo(() => {
    if (!t) return [];
    return [...t.calendar.days].sort((a, b) => a.date.localeCompare(b.date));
  }, [t]);

  const option = useMemo(() => {
    const cats = days.map((d) => d.date.slice(5)); // MM-DD
    const seriesData = days.map((d) => {
      if (metric === "n") return d.n;
      if (metric === "net_pnl") return Number(d.net_pnl);
      return d.r != null ? Number(d.r) : 0;
    });
    return {
      grid: { left: 48, right: 16, top: 24, bottom: 48 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: { dataIndex: number }[]) => {
          const i = params[0]?.dataIndex;
          if (i == null || !days[i]) return "";
          const d = days[i];
          const r = d.r != null ? `${num(d.r, 2)}R` : "—";
          return `${d.date}<br/>R ${r}<br/>P&L ${money(d.net_pnl, currency)}<br/>Trades ${d.n}<br/>${d.record}`;
        },
      },
      xAxis: {
        type: "category",
        data: cats,
        axisLabel: { fontSize: 10, rotate: days.length > 20 ? 45 : 0, color: C.muted },
        axisLine: { lineStyle: { color: C.line } },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: C.line } },
        axisLabel: { fontSize: 10, color: C.muted },
      },
      series: [
        {
          type: "bar",
          barMaxWidth: 18,
          data: seriesData.map((v) => ({
            value: v,
            itemStyle: {
              color:
                metric === "n"
                  ? C.blue
                  : v > 0
                    ? C.pos
                    : v < 0
                      ? C.neg
                      : C.muted,
              borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3],
            },
          })),
        },
      ],
    };
  }, [days, metric, C, currency]);

  if (!t) return null;

  return (
    <ChartCard
      title="Daily performance"
      sampleSize={days.reduce((s, d) => s + d.n, 0)}
      actions={
        <div className="modes" role="group" aria-label="Daily metric">
          {(
            [
              ["net_pnl", "P&L"],
              ["r", "R Multiple"],
              ["n", "Trades"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={metric === id ? "on" : ""}
              aria-pressed={metric === id}
              onClick={() => setMetric(id)}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {days.length === 0 ? (
        <Empty>No trading days in this period.</Empty>
      ) : (
        <InteractiveChart
          option={option}
          height={260}
          showHint={false}
          onChartClick={(e) => {
            if (!drill || e.dataIndex == null) return;
            const d = days[e.dataIndex];
            if (!d) return;
            drill.applyPatch(filterForSingleDay(d.date), d.date);
            drill.openTrades(`Trades on ${d.date}`);
          }}
        />
      )}
      <style jsx>{`
        .modes {
          display: inline-flex;
          gap: 4px;
          padding: 3px;
          border-radius: 999px;
          background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .modes button {
          border: 0;
          background: transparent;
          color: var(--text-muted);
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
        }
        .modes button.on {
          background: var(--accent-soft);
          color: var(--accent);
        }
      `}</style>
    </ChartCard>
  );
}
