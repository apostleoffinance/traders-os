"use client";

import { useMemo, useState } from "react";
import { Empty, HorizontalBars, MetricToggle, useLiveChart } from "@/components/analytics/Charts";
import { ChartCard } from "@/components/trader";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard, GroupRow, LabLeaderboardRow, MetricKey } from "@/lib/analytics";
import { colorForPnl } from "@/lib/chart-colors";
import {
  generateInstrumentInsight,
  generateSessionInsight,
  generateSetupInsight,
  generateTimeOfDayInsight,
} from "@/lib/analytics/insights/generators";
import { formatSampleSize, resolveVizCopy } from "@/lib/visualization";
import { num, sessionLabel, signed } from "@/lib/format";

function toGroupRows(rows: LabLeaderboardRow[]): GroupRow[] {
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

type RankDimension = "instrument" | "setup" | "session";

/**
 * Ranking-first edge board — horizontal bars answer "which is better?"
 * Table details stay secondary.
 */
function EdgeRankPanel({
  analyticsId,
  rows,
  dimension,
  labelFn,
  setupIdForName,
}: {
  analyticsId: string;
  rows: LabLeaderboardRow[];
  dimension: RankDimension;
  labelFn?: (k: string) => string;
  setupIdForName?: (name: string) => string | undefined;
}) {
  const copy = resolveVizCopy(analyticsId);
  const [metric, setMetric] = useState<MetricKey>("expectancy_r");
  const [showTable, setShowTable] = useState(false);
  const drill = useOptionalAnalyticsDrilldown();

  const sorted = useMemo(() => {
    const copyRows = [...rows].filter((r) => r.n > 0);
    copyRows.sort((a, b) => {
      const av = a[metric === "n" ? "n" : metric];
      const bv = b[metric === "n" ? "n" : metric];
      const an = av == null ? -Infinity : Number(av);
      const bn = bv == null ? -Infinity : Number(bv);
      return bn - an;
    });
    return copyRows;
  }, [rows, metric]);

  const top = sorted.slice(0, 10);
  const groupN = top.reduce((s, r) => s + r.n, 0);
  const insight = useMemo(() => {
    const vm = sorted.map((r) => ({
      key: r.key,
      label: labelFn ? labelFn(r.key) : r.label || r.key,
      trades: r.n,
      netPnl: Number(r.net_pnl ?? 0),
      winRate: r.win_rate != null ? Number(r.win_rate) : null,
      profitFactor: r.profit_factor != null ? Number(r.profit_factor) : null,
      expectancy: r.expectancy_r != null ? Number(r.expectancy_r) : null,
      averageR: r.average_r != null ? Number(r.average_r) : null,
    }));
    if (dimension === "instrument") return generateInstrumentInsight(vm);
    if (dimension === "setup") return generateSetupInsight(vm);
    return generateSessionInsight(vm);
  }, [sorted, dimension, labelFn]);

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
    drill.openTrades(`${copy.title}: ${label}`);
  }

  const best = top[0];
  const bestLabel = best ? (labelFn ? labelFn(best.key) : best.label || best.key) : null;

  return (
    <ChartCard
      title={copy.title}
      question={copy.question}
      tier="essential"
      sampleSize={groupN}
      subtitle={
        bestLabel && best?.expectancy_r != null
          ? `Top: ${bestLabel} · ${signed(best.expectancy_r)}R expectancy · ${best.n} trades`
          : "Ranked by the metric you select — sample size shown on each bar."
      }
      insight={insight}
      interactive
      actions={<MetricToggle value={metric} onChange={setMetric} />}
    >
      {top.length === 0 ? (
        <Empty>No closed trades for this dimension.</Empty>
      ) : (
        <>
          <HorizontalBars
            rows={toGroupRows(top)}
            metric={metric}
            labelFn={labelFn}
            onRowClick={drill ? handleRowClick : undefined}
          />
          <button type="button" className="table-toggle" onClick={() => setShowTable((v) => !v)}>
            {showTable ? "Hide details table" : "Show details table"}
          </button>
          {showTable ? (
            <table className="lb">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>n</th>
                  <th>Expectancy</th>
                  <th>Win%</th>
                  <th>PF</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r) => (
                  <tr key={r.key} className={r.sample_label === "insufficient" ? "muted-row" : ""}>
                    <td>{labelFn ? labelFn(r.key) : r.key}</td>
                    <td>{r.n}</td>
                    <td>{r.expectancy_r ? `${signed(r.expectancy_r)}R` : "—"}</td>
                    <td>{r.win_rate ? `${num(r.win_rate, 1)}%` : "—"}</td>
                    <td>{r.profit_factor ? num(r.profit_factor) : "—"}</td>
                    <td className="note">{r.sample_note ?? r.evidence.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </>
      )}
      <style jsx>{`
        .table-toggle {
          margin-top: 10px;
          border: none;
          background: transparent;
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
        }
        .lb {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-top: 10px;
        }
        th,
        td {
          padding: 6px 8px;
          border-bottom: 1px solid var(--border);
          text-align: left;
        }
        td:not(:first-child) {
          font-variant-numeric: tabular-nums;
        }
        .note {
          font-size: 11px;
          color: var(--text-muted);
        }
        .muted-row {
          opacity: 0.65;
        }
      `}</style>
    </ChartCard>
  );
}

export function EdgeLabSections({
  data,
  mode = "essential",
}: {
  data: AnalyticsDashboard;
  mode?: "essential" | "bubble" | "full";
}) {
  const lab = data.lab;
  const drill = useOptionalAnalyticsDrilldown();
  if (!lab) return null;
  const { edge } = lab;
  const { C } = useLiveChart();
  const timeCopy = resolveVizCopy("time_of_day");
  const heatCopy = resolveVizCopy("time_heatmap");
  const setupIdForName = (name: string) => data.filters.options?.setups.find((s) => s.name === name)?.id;

  const hourData = edge.time_of_day.by_hour.filter((h) => h.n > 0);
  const timeInsight = useMemo(
    () =>
      generateTimeOfDayInsight(
        hourData.map((h) => ({
          hour: h.hour,
          n: h.n,
          expectancy: h.expectancy_r ? Number(h.expectancy_r) : null,
        })),
      ),
    [hourData],
  );

  const instrumentBubble = {
    grid: { left: 48, right: 16, top: 16, bottom: 48 },
    tooltip: {
      formatter: (p: { data: { name: string; value: number[]; n?: number } }) =>
        `${p.data.name}<br/>Win rate ${num(p.data.value[0], 1)}%<br/>Expectancy ${num(p.data.value[1])}R${
          p.data.n != null ? `<br/>${p.data.n} trades` : ""
        }`,
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
            n: r.n,
            value: [Number(r.win_rate), Number(r.expectancy_r)],
            symbolSize: Math.max(16, Math.min(64, r.n * 3)),
            itemStyle: { color: colorForPnl(C, r.expectancy_r) },
          })),
      },
    ],
  };

  const hourChart = {
    grid: { left: 44, right: 16, top: 16, bottom: 32 },
    tooltip: {
      formatter: (p: { dataIndex: number }) => {
        const h = hourData[p.dataIndex];
        return `${h.hour}:00 · ${h.n} trades<br/>Expectancy ${h.expectancy_r ?? "—"}R · Win rate ${h.win_rate ?? "—"}%`;
      },
    },
    xAxis: { type: "category", data: hourData.map((h) => `${h.hour}:00`), axisLabel: { fontSize: 9, rotate: 45 } },
    yAxis: { type: "value", name: "Expectancy R", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        barMaxWidth: hourData.length <= 12 ? 32 : undefined,
        data: hourData.map((h) => ({
          value: h.expectancy_r ? Number(h.expectancy_r) : 0,
          itemStyle: { color: h.n < 5 ? C.muted : Number(h.expectancy_r) >= 0 ? C.pos : C.neg },
        })),
        label: {
          show: hourData.length <= 12,
          position: "top",
          fontSize: 9,
          formatter: (p: { dataIndex: number }) => formatSampleSize(hourData[p.dataIndex].n),
        },
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
        return `${days[dayIdx]} ${hour}:00<br/>${signed(exp)}R expectancy · ${n} trades`;
      },
    },
    grid: { left: 72, right: 24, top: 16, bottom: 48 },
    xAxis: { type: "category", data: Array.from({ length: 24 }, (_, i) => `${i}`), splitArea: { show: true } },
    yAxis: { type: "category", data: days, splitArea: { show: true } },
    visualMap: {
      min: -2,
      max: 2,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      text: ["Strong+", "Strong−"],
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
      {(mode === "essential" || mode === "full") && (
        <>
          <section className="edge-lead">
            <h3 className="edge-title">Where results are strongest</h3>
            <p className="edge-copy">
              Compare groups by expectancy first. Prefer rows with enough trades — small samples are marked muted on the
              detail table.
            </p>
          </section>
          <EdgeRankPanel analyticsId="instrument_performance" rows={edge.instruments} dimension="instrument" />
          <EdgeRankPanel
            analyticsId="setup_performance"
            rows={edge.setups}
            dimension="setup"
            labelFn={(k) => (k === "unclassified" ? "Unclassified" : k)}
            setupIdForName={setupIdForName}
          />
          <EdgeRankPanel
            analyticsId="session_performance"
            rows={edge.sessions}
            dimension="session"
            labelFn={sessionLabel}
          />

          <ChartCard
            title={timeCopy.title}
            question={timeCopy.question}
            tier="essential"
            sampleSize={lab.metadata.sample_size}
            evidenceLabel={lab.metadata.evidence.label}
            subtitle={`Hour-of-day in ${edge.time_of_day.timezone}. Muted bars have fewer than 5 trades.`}
            insight={timeInsight}
            interactive
          >
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
        </>
      )}

      {(mode === "bubble" || mode === "full") && (
        <>
          <ChartCard
            title="Instrument edge map"
            question="Which instruments cluster by win rate and expectancy?"
            tier="deep_dive"
            subtitle="What to look for: upper-right = higher win rate and expectancy. Bubble size = sample size."
            interactive
          >
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

          <ChartCard
            title={heatCopy.title}
            question={heatCopy.question}
            tier="deep_dive"
            subtitle="Green = positive expectancy · red = negative. Hover for exact R and sample size."
            interactive
          >
            {heatCells.length === 0 ? (
              <Empty>Insufficient data for heatmap.</Empty>
            ) : (
              <InteractiveChart
                option={heatmap}
                height={320}
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
        </>
      )}

      <style jsx>{`
        .edge-lead {
          margin: 4px 0 12px;
        }
        .edge-title {
          margin: 0 0 4px;
          font-size: 14px;
          font-weight: 600;
        }
        .edge-copy {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
          max-width: 62ch;
        }
      `}</style>
    </>
  );
}
