"use client";

import { useMemo, useState } from "react";
import { ChartCard, RankList, sortEdgeRows } from "@/components/trader";
import { HorizontalBars } from "@/components/analytics/Charts";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useLiveChart } from "@/components/analytics/Charts";
import { ReportChapter } from "@/components/reports/story/ReportChapter";
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
  const [showDetails, setShowDetails] = useState(false);
  const instruments = (edge.instruments ?? []) as EdgeRow[];
  const setups = (edge.setups ?? []) as EdgeRow[];
  const sessions = (edge.sessions ?? []) as EdgeRow[];
  const tod = edge.time_of_day as { heatmap?: { hour: number; day: string; expectancy_r: string | null; n: number }[] } | undefined;

  const topSetup = sortEdgeRows(setups, (k) => (k === "unclassified" ? "Unclassified" : k))[0];
  const takeaway = topSetup
    ? `Strongest setup by expectancy: ${topSetup.label} (${topSetup.expectancy != null ? `${topSetup.expectancy.toFixed(2)}R` : "—"}, n=${topSetup.trades}).`
    : "Not enough tagged setups to rank edge yet.";

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

  return (
    <ReportChapter id="edge" title="2. Edge" question="Where did my edge show up?" takeaway={takeaway}>
      <div className="ranks">
        <RankList title="Top instruments" rows={sortEdgeRows(instruments)} />
        <RankList title="Top setups" rows={sortEdgeRows(setups, (k) => (k === "unclassified" ? "Unclassified" : k))} />
        <RankList title="Top sessions" rows={sortEdgeRows(sessions)} />
      </div>

      <button type="button" className="details-toggle" aria-expanded={showDetails} onClick={() => setShowDetails((v) => !v)}>
        {showDetails ? "Hide ranking detail & maps" : "Show ranking detail & maps"}
      </button>

      {showDetails && (
        <div className="details">
          <ChartCard title="Instrument ranking" interactive={false}>
            <HorizontalBars rows={instruments.map(toGroupRow)} metric="expectancy_r" />
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
          {scatter && (
            <ChartCard title="Instrument edge map" subtitle="Win rate × expectancy · bubble size = sample">
              <InteractiveChart option={scatter} size="standard" showHint={false} ariaLabel="Instrument edge scatter" />
            </ChartCard>
          )}
          {heatmap && (
            <ChartCard title="Day × hour heatmap">
              <InteractiveChart option={heatmap} size="standard" showHint={false} ariaLabel="Day hour expectancy heatmap" />
            </ChartCard>
          )}
        </div>
      )}

      <style jsx>{`
        .ranks {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }
        .details-toggle {
          border: 1px solid var(--border);
          background: transparent;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          cursor: pointer;
          margin-bottom: 12px;
        }
        .details {
          display: grid;
          gap: 12px;
        }
      `}</style>
    </ReportChapter>
  );
}
