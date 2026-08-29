"use client";

import { useRouter } from "next/navigation";
import { Empty, useLiveChart } from "@/components/analytics/Charts";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { IntelligenceLab } from "@/components/intelligence/Phase3Intelligence";
import { money, num } from "@/lib/format";

type PsychRow = {
  emotion: string;
  n: number;
  win_rate: string | null;
  expectancy_r: string | null;
  net_pnl: string | null;
};

type DisciplineScatterPt = {
  trade_id: string;
  discipline_score: number;
  net_pnl: string;
  realized_r: string | null;
  result: string;
};

export function PsychologyBubbleMatrix({
  intel,
  currency = "USD",
}: {
  intel: IntelligenceLab;
  currency?: string;
}) {
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const psych = intel.psychology as {
    matrix_before?: PsychRow[];
    disclaimer?: string;
  };
  const rows = (psych.matrix_before ?? []).filter((r) => r.n > 0);
  if (!rows.length) {
    return (
      <ChartCard title="Psychology performance matrix">
        <Empty>Tag trades with pre-trade emotions to populate this matrix.</Empty>
      </ChartCard>
    );
  }

  const maxN = Math.max(...rows.map((r) => r.n), 1);
  const option = {
    grid: { left: 52, right: 24, top: 24, bottom: 48 },
    tooltip: {
      trigger: "item",
      formatter: (p: { data: { emotion: string; value: [number, number]; n: number } }) =>
        `${p.data.emotion}<br/>Win ${num(p.data.value[0], 1)}% · Exp ${num(p.data.value[1])}R<br/>n=${p.data.n}`,
    },
    xAxis: { type: "value", name: "Win rate %", min: 0, max: 100, splitLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "value", name: "Expectancy R", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        name: "Emotions",
        type: "scatter",
        data: rows.map((r) => ({
          value: [Number(r.win_rate ?? 0), Number(r.expectancy_r ?? 0)],
          emotion: r.emotion,
          n: r.n,
          symbolSize: Math.max(14, (r.n / maxN) * 48),
          itemStyle: {
            color: Number(r.expectancy_r ?? 0) >= 0 ? C.pos : C.neg,
            opacity: 0.85,
          },
        })),
      },
    ],
  };

  return (
    <ChartCard title="Psychology bubble matrix · pre-trade emotion" subtitle="Bubble size = sample size" interactive>
      <InteractiveChart
        option={option}
        height={300}
        showHint={false}
        onChartClick={(e) => {
          const emotion = (e.data as { emotion?: string } | undefined)?.emotion;
          if (!drill || !emotion) return;
          drill.applyPatch({ psychology: emotion }, emotion);
          drill.openTrades(`${emotion} trades`);
        }}
      />
      {psych.disclaimer && <p className="muted">{psych.disclaimer}</p>}
      <style jsx>{`
        .muted {
          font-size: 13px;
          margin: 8px 0 0;
        }
      `}</style>
    </ChartCard>
  );
}

export function DisciplineScatterPanel({
  intel,
  currency = "USD",
}: {
  intel: IntelligenceLab;
  currency?: string;
}) {
  const { C } = useLiveChart();
  const router = useRouter();
  const discipline = intel.discipline as {
    discipline_vs_performance?: {
      scatter?: DisciplineScatterPt[];
      buckets?: { bucket: string; n: number; expectancy_r: string | null; net_pnl: string | null }[];
    };
  };
  const scatter = discipline.discipline_vs_performance?.scatter ?? [];
  const buckets = discipline.discipline_vs_performance?.buckets ?? [];

  if (!scatter.length && !buckets.length) {
    return (
      <ChartCard title="Discipline vs P&L">
        <Empty>Discipline scores are not available for trades in this filter.</Empty>
      </ChartCard>
    );
  }

  const scatterOption =
    scatter.length > 0
      ? {
          grid: { left: 52, right: 16, top: 24, bottom: 40 },
          tooltip: {
            trigger: "item",
            formatter: (p: { data: { value: [number, number]; result: string } }) =>
              `Score ${p.data.value[0]} · ${money(p.data.value[1], currency)} · ${p.data.result}`,
          },
          xAxis: { type: "value", name: "Discipline score", min: 0, max: 100, splitLine: { lineStyle: { color: C.line } } },
          yAxis: { type: "value", name: "Net P&L", splitLine: { lineStyle: { color: C.line } } },
          series: [
            {
              name: "Trades",
              type: "scatter",
              symbolSize: 9,
              data: scatter.map((p) => ({
                value: [p.discipline_score, Number(p.net_pnl)],
                tradeId: p.trade_id,
                result: p.result,
                itemStyle: { color: Number(p.net_pnl) >= 0 ? C.pos : C.neg },
              })),
            },
          ],
        }
      : null;

  const bucketOption =
    buckets.length > 0
      ? {
          grid: { left: 44, right: 16, top: 16, bottom: 48 },
          tooltip: { trigger: "axis" },
          xAxis: { type: "category", data: buckets.map((b) => b.bucket), axisLabel: { rotate: 20, fontSize: 10 } },
          yAxis: { type: "value", name: "Expectancy R", splitLine: { lineStyle: { color: C.line } } },
          series: [
            {
              type: "bar",
              data: buckets.map((b) => ({
                value: Number(b.expectancy_r ?? 0),
                itemStyle: { color: Number(b.expectancy_r ?? 0) >= 0 ? C.pos : C.neg },
              })),
            },
          ],
        }
      : null;

  return (
    <ChartCard title="Discipline vs performance" subtitle="Each dot is a trade. Bucket bars show expectancy by discipline band." interactive>
      {scatterOption && (
        <InteractiveChart
          option={scatterOption}
          height={280}
          showHint={false}
          onChartClick={(e) => {
            const tradeId = (e.data as { tradeId?: string } | undefined)?.tradeId;
            if (tradeId) router.push(`/trades/${tradeId}`);
          }}
        />
      )}
      {bucketOption && <InteractiveChart option={bucketOption} height={220} showHint={false} />}
    </ChartCard>
  );
}

export function DecisionQualityChart({ intel }: { intel: IntelligenceLab }) {
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const dq = intel.decision_quality;
  const cells = [
    { key: "good_win", label: dq.labels.good_win, count: dq.counts.good_win, result: "win" as const },
    { key: "lucky_win", label: dq.labels.lucky_win, count: dq.counts.lucky_win, result: "win" as const },
    { key: "good_loss", label: dq.labels.good_loss, count: dq.counts.good_loss, result: "loss" as const },
    { key: "bad_loss", label: dq.labels.bad_loss, count: dq.counts.bad_loss, result: "loss" as const },
  ];

  const option = {
    grid: { left: 44, right: 16, top: 16, bottom: 56 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: cells.map((c) => c.label), axisLabel: { fontSize: 10, rotate: 18 } },
    yAxis: { type: "value", name: "Trades", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        data: cells.map((c) => ({
          value: c.count,
          itemStyle: { color: c.key.includes("good") ? C.pos : C.neg },
          key: c.key,
          result: c.result,
        })),
      },
    ],
  };

  return (
    <ChartCard title="Process vs outcome" sampleSize={dq.sample_size} subtitle={dq.methodology} interactive>
      <InteractiveChart
        option={option}
        height={240}
        showHint={false}
        onChartClick={(e) => {
          if (!drill || e.dataIndex == null) return;
          const cell = cells[e.dataIndex];
          drill.applyPatch({ result: cell.result }, cell.label);
          drill.openTrades(cell.label);
        }}
      />
    </ChartCard>
  );
}
