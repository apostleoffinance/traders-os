"use client";

import { useMemo, useState } from "react";
import { Panel } from "@/components/ui";
import { Empty, EvidenceTag, HorizontalBars, useLiveChart } from "@/components/analytics/Charts";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard, LabLeaderboardRow } from "@/lib/analytics";
import { num, sessionLabel, signed } from "@/lib/format";

type SortKey = "net_r" | "expectancy_r" | "n" | "net_pnl" | "win_rate" | "profit_factor";

function toGroupRows(rows: LabLeaderboardRow[]) {
  return rows.map((r) => ({
    key: r.key,
    n: r.n,
    net_pnl: r.net_pnl ?? "0",
    expectancy_r: r.expectancy_r ?? null,
    win_rate: r.win_rate,
    average_r: r.average_r ?? null,
    profit_factor: r.profit_factor ?? null,
    insight: r.sample_note ?? null,
    evidence: r.evidence,
  }));
}

function Leaderboard({
  title,
  rows,
  labelFn,
}: {
  title: string;
  rows: LabLeaderboardRow[];
  labelFn?: (k: string) => string;
}) {
  const [sort, setSort] = useState<SortKey>("expectancy_r");
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      const an = av == null ? -Infinity : Number(av);
      const bn = bv == null ? -Infinity : Number(bv);
      return bn - an;
    });
    return copy;
  }, [rows, sort]);

  return (
    <Panel
      title={title}
      right={
        <select className="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
          <option value="expectancy_r">Expectancy R</option>
          <option value="net_r">Net R</option>
          <option value="net_pnl">Net P&L</option>
          <option value="win_rate">Win rate</option>
          <option value="profit_factor">Profit factor</option>
          <option value="n">Trade count</option>
        </select>
      }
    >
      {rows.length === 0 ? (
        <Empty>No closed trades for this dimension.</Empty>
      ) : (
        <>
          <table className="lb">
            <thead>
              <tr>
                <th>Name</th>
                <th>n</th>
                <th>Net R</th>
                <th>Win%</th>
                <th>PF</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 12).map((r) => (
                <tr key={r.key} className={r.sample_label === "insufficient" ? "muted-row" : ""}>
                  <td>{labelFn ? labelFn(r.key) : r.key}</td>
                  <td>{r.n}</td>
                  <td>{r.net_r ? `${signed(r.net_r)}R` : "—"}</td>
                  <td>{r.win_rate ? `${num(r.win_rate, 1)}%` : "—"}</td>
                  <td>{r.profit_factor ? num(r.profit_factor) : "—"}</td>
                  <td className="note">{r.sample_note ?? r.evidence.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <HorizontalBars rows={toGroupRows(sorted.slice(0, 8))} metric="expectancy_r" labelFn={labelFn} />
        </>
      )}
      <style jsx>{`
        .sort {
          font-size: 12px;
          border: 1px solid var(--line);
          background: var(--surface);
          padding: 4px 8px;
          border-radius: 4px;
        }
        .lb {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-bottom: 12px;
        }
        th,
        td {
          padding: 6px 8px;
          border-bottom: 1px solid var(--line);
          text-align: left;
        }
        td:not(:first-child) {
          font-family: var(--font-mono), monospace;
        }
        .note {
          font-family: inherit;
          font-size: 11px;
          color: var(--muted);
        }
        .muted-row {
          opacity: 0.65;
        }
      `}</style>
    </Panel>
  );
}

export function EdgeLabSections({ data }: { data: AnalyticsDashboard }) {
  const lab = data.lab;
  const drill = useOptionalAnalyticsDrilldown();
  if (!lab) return null;
  const { edge } = lab;
  const { C } = useLiveChart();

  const instrumentBubble = {
    grid: { left: 48, right: 16, top: 16, bottom: 48 },
    tooltip: {
      formatter: (p: { data: { name: string; value: number[] } }) =>
        `${p.data.name}<br/>Win rate ${num(p.data.value[0], 1)}%<br/>Expectancy ${num(p.data.value[1])}R`,
    },
    xAxis: { type: "value", name: "Win rate %", splitLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "value", name: "Expectancy R", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "scatter",
        data: edge.instruments
          .filter((r) => r.n > 0 && r.win_rate && r.expectancy_r)
          .map((r) => ({
            name: r.key,
            value: [Number(r.win_rate), Number(r.expectancy_r)],
            symbolSize: Math.max(16, Math.min(64, r.n * 3)),
          })),
        itemStyle: { color: C.blue },
      },
    ],
  };

  const hourData = edge.time_of_day.by_hour.filter((h) => h.n > 0);
  const hourChart = {
    grid: { left: 44, right: 16, top: 16, bottom: 32 },
    tooltip: {
      formatter: (p: { dataIndex: number }) => {
        const h = hourData[p.dataIndex];
        return `${h.hour}:00 · n=${h.n}<br/>Exp ${h.expectancy_r ?? "—"}R · WR ${h.win_rate ?? "—"}%`;
      },
    },
    xAxis: { type: "category", data: hourData.map((h) => `${h.hour}:00`), axisLabel: { fontSize: 9, rotate: 45 } },
    yAxis: { type: "value", name: "Expectancy R", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        data: hourData.map((h) => ({
          value: h.expectancy_r ? Number(h.expectancy_r) : 0,
          itemStyle: { color: h.n < 5 ? C.muted : Number(h.expectancy_r) >= 0 ? C.pos : C.neg },
        })),
      },
    ],
  };

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const heatCells = edge.time_of_day.heatmap;
  const heatData = heatCells.map((c) => [c.hour, days.indexOf(c.day), c.expectancy_r ? Number(c.expectancy_r) : 0, c.n]);
  const heatmap = {
    tooltip: {
      formatter: (p: { data: [number, number, number, number] }) => {
        const [hour, dayIdx, exp, n] = p.data;
        return `${days[dayIdx]} ${hour}:00 · n=${n}<br/>Expectancy ${exp.toFixed(2)}R`;
      },
    },
    grid: { left: 72, right: 24, top: 16, bottom: 40 },
    xAxis: { type: "category", data: Array.from({ length: 24 }, (_, i) => `${i}`), splitArea: { show: true } },
    yAxis: { type: "category", data: days, splitArea: { show: true } },
    visualMap: {
      min: -2,
      max: 2,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: [C.neg, C.bg, C.pos] },
    },
    series: [
      {
        type: "heatmap",
        data: heatData,
        label: { show: false },
        emphasis: { itemStyle: { shadowBlur: 6 } },
      },
    ],
  };

  return (
    <>
      <ChartCard title="Instrument edge map" subtitle="Win rate × expectancy · bubble size = sample" interactive>
        {edge.instruments.length === 0 ? (
          <Empty>No instrument data.</Empty>
        ) : (
          <InteractiveChart
            option={instrumentBubble}
            height={280}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || !e.name) return;
              drill.applyPatch({ symbol: e.name }, e.name);
              drill.openTrades(`${e.name} trades`);
            }}
          />
        )}
      </ChartCard>
      <Leaderboard title="Instrument performance" rows={edge.instruments} />
      <Leaderboard title="Setup performance" rows={edge.setups} labelFn={(k) => (k === "unclassified" ? "Unclassified" : k)} />
      <Leaderboard title="Session performance" rows={edge.sessions} labelFn={sessionLabel} />

      <ChartCard title="Time of day" sampleSize={lab.metadata.sample_size} evidenceLabel={lab.metadata.evidence.label} subtitle={`Hour-of-day in ${edge.time_of_day.timezone}`} interactive>
        {hourData.length === 0 ? (
          <Empty>No trades to chart.</Empty>
        ) : (
          <InteractiveChart
            option={hourChart}
            height={260}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || e.dataIndex == null) return;
              const h = hourData[e.dataIndex];
              if (!h) return;
              drill.applyPatch({ hour: String(h.hour) }, `${h.hour}:00`);
              drill.openTrades(`Trades at ${h.hour}:00`);
            }}
          />
        )}
      </ChartCard>

      <ChartCard title="Day × hour heatmap (expectancy R)" interactive>
        {heatCells.length === 0 ? (
          <Empty>Insufficient data for heatmap.</Empty>
        ) : (
          <InteractiveChart
            option={heatmap}
            height={300}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || !e.data || !Array.isArray(e.data)) return;
              const hour = e.data[0];
              drill.applyPatch({ hour: String(hour) }, `${hour}:00`);
              drill.openTrades(`Trades at ${hour}:00`);
            }}
          />
        )}
      </ChartCard>
      <style jsx>{`
        .muted {
          font-size: 13px;
          margin: 0 0 10px;
        }
      `}</style>
    </>
  );
}
