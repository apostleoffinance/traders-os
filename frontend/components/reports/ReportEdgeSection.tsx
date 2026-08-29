"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { HorizontalBars } from "@/components/analytics/Charts";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useLiveChart } from "@/components/analytics/Charts";
import { num } from "@/lib/format";
import type { Evidence, GroupRow } from "@/lib/analytics";

type EdgeRow = {
  key: string;
  n: number;
  win_rate: string | null;
  expectancy_r: string | null;
  net_pnl: string | null;
  evidence?: Partial<Evidence>;
};

function toEvidence(n: number, partial?: Partial<Evidence>): Evidence {
  if (partial?.n != null && partial.level && partial.label && partial.reason != null) {
    return partial as Evidence;
  }
  const level: Evidence["level"] = n < 5 ? "INSUFFICIENT" : n < 10 ? "LOW" : n < 30 ? "MODERATE" : "HIGH";
  return {
    n,
    level,
    label: level === "INSUFFICIENT" ? "Insufficient sample" : level.toLowerCase(),
    reason: partial?.reason ?? "",
  };
}

function toGroupRow(r: EdgeRow): GroupRow {
  return {
    key: r.key,
    n: r.n,
    net_pnl: r.net_pnl ?? "0",
    expectancy_r: r.expectancy_r,
    win_rate: r.win_rate,
    average_r: null,
    profit_factor: null,
    evidence: toEvidence(r.n, r.evidence),
    insight: null,
  };
}

export function ReportEdgeSection({ edge }: { edge: Record<string, unknown> }) {
  const { C } = useLiveChart();
  const instruments = (edge.instruments ?? []) as EdgeRow[];
  const setups = (edge.setups ?? []) as EdgeRow[];
  const sessions = (edge.sessions ?? []) as EdgeRow[];
  const tod = edge.time_of_day as { heatmap?: { hour: number; day: string; expectancy_r: string | null; n: number }[] } | undefined;

  const scatter = useMemo(() => {
    if (!instruments.length) return null;
    return {
      grid: { left: 52, right: 24, top: 24, bottom: 48 },
      tooltip: {
        trigger: "item",
        formatter: (p: { data: { symbol: string; n: number; value: [number, number] } }) =>
          `${p.data.symbol}<br/>Win ${num(p.data.value[0], 1)}% · Exp ${num(p.data.value[1])}R · n=${p.data.n}`,
      },
      xAxis: { type: "value", name: "Win rate %", min: 0, max: 100, splitLine: { lineStyle: { color: C.line } } },
      yAxis: { type: "value", name: "Expectancy R", splitLine: { lineStyle: { color: C.line } } },
      series: [
        {
          type: "scatter",
          data: instruments
            .filter((r) => r.n > 0)
            .map((r) => ({
              value: [Number(r.win_rate ?? 0), Number(r.expectancy_r ?? 0)],
              symbol: r.key,
              symbolSize: Math.max(12, Math.min(48, r.n * 3)),
              n: r.n,
              itemStyle: { color: Number(r.expectancy_r ?? 0) >= 0 ? C.pos : C.neg },
            })),
        },
      ],
    };
  }, [instruments, C]);

  const heatCells = tod?.heatmap ?? [];
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const heatmap = heatCells.length
    ? {
        grid: { left: 72, right: 24, top: 16, bottom: 40 },
        tooltip: {
          formatter: (p: { data: [number, number, number, number] }) => {
            const [hour, dayIdx, exp, n] = p.data;
            return `${days[dayIdx]} ${hour}:00 · n=${n}<br/>Expectancy ${num(exp)}R`;
          },
        },
        xAxis: { type: "category", data: Array.from({ length: 24 }, (_, i) => `${i}`), splitArea: { show: true } },
        yAxis: { type: "category", data: days, splitArea: { show: true } },
        visualMap: { min: -2, max: 2, calculable: true, orient: "horizontal", left: "center", bottom: 0, inRange: { color: [C.neg, C.bg, C.pos] } },
        series: [{ type: "heatmap", data: heatCells.map((c) => [c.hour, days.indexOf(c.day), Number(c.expectancy_r ?? 0), c.n]) }],
      }
    : null;

  const instRows = instruments.map(toGroupRow);

  return (
    <>
      <h2 className="section-title">Where does your edge exist?</h2>
      <ChartCard title="Instrument edge map" subtitle="Win rate × expectancy · bubble size = sample" interactive>
        {scatter ? <InteractiveChart option={scatter} height={280} showHint={false} /> : <p className="muted">No instrument data.</p>}
      </ChartCard>
      <ChartCard title="Instrument ranking" interactive>
        <HorizontalBars rows={instRows} metric="expectancy_r" />
      </ChartCard>
      <ChartCard title="Setup performance">
        <HorizontalBars
          rows={setups.map(toGroupRow)}
          metric="expectancy_r"
          labelFn={(k) => (k === "unclassified" ? "Unclassified" : k)}
        />
      </ChartCard>
      <ChartCard title="Session performance">
        <HorizontalBars rows={sessions.map(toGroupRow)} metric="expectancy_r" />
      </ChartCard>
      {heatmap && (
        <ChartCard title="Day × hour heatmap" interactive>
          <InteractiveChart option={heatmap} height={300} showHint={false} />
        </ChartCard>
      )}
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 16px;
        }
        .muted {
          color: var(--muted);
          font-size: 13px;
        }
      `}</style>
    </>
  );
}
