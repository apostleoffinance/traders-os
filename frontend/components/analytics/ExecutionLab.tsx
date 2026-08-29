"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Stat } from "@/components/ui";
import { Empty, useLiveChart } from "@/components/analytics/Charts";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard, LabBucketRow } from "@/lib/analytics";
import { captureHistogramBins, linearRegression } from "@/lib/chart-regression";
import { colorForPnl } from "@/lib/chart-colors";
import {
  generateBucketInsight,
  generateExitEfficiencyInsight,
  generateMfeMaeInsight,
} from "@/lib/analytics/insights/generators";
import { getAnalyticsDefinition } from "@/lib/analytics/registry";
import { ExitEfficiencySummary } from "@/components/analytics/primitives/ExitEfficiencySummary";
import { ScatterQuadrantGuide } from "@/components/analytics/primitives/ScatterQuadrantGuide";
import { num, signed } from "@/lib/format";

export function ExecutionLab({
  data,
  variant = "all",
}: {
  data: AnalyticsDashboard;
  variant?: "essential" | "advanced" | "all";
}) {
  const showEssential = variant === "essential" || variant === "all";
  const showAdvanced = variant === "advanced" || variant === "all";
  const lab = data.lab;
  const router = useRouter();
  const drill = useOptionalAnalyticsDrilldown();
  const { C } = useLiveChart();

  const riskPoints = useMemo(
    () =>
      data.risk_vs_result
        .filter((d) => Number(d.risk_percent) > 0)
        .map((d) => ({
          tradeId: d.id,
          x: Number(d.risk_percent),
          y: Number(d.realized_r),
          symbol: d.symbol,
          result: d.result,
        })),
    [data.risk_vs_result],
  );

  const regression = useMemo(() => linearRegression(riskPoints.map((p) => ({ x: p.x, y: p.y }))), [riskPoints]);

  const captureBins = useMemo(
    () => (lab?.execution.exit_efficiency.scatter?.length ? captureHistogramBins(lab.execution.exit_efficiency.scatter) : []),
    [lab?.execution.exit_efficiency.scatter],
  );

  const sizeInsight = useMemo(
    () =>
      lab
        ? generateBucketInsight(
            lab.execution.position_size.buckets.map((b) => ({
              label: b.bucket,
              n: b.n,
              expectancy: b.expectancy_r ? Number(b.expectancy_r) : null,
            })),
            "Expectancy by position size bucket.",
          )
        : null,
    [lab],
  );
  const durInsight = useMemo(
    () =>
      lab
        ? generateBucketInsight(
            lab.execution.duration.buckets.map((b) => ({
              label: b.bucket,
              n: b.n,
              expectancy: b.expectancy_r ? Number(b.expectancy_r) : null,
            })),
            "Expectancy by holding time bucket.",
          )
        : null,
    [lab],
  );

  if (!lab) return null;
  const ex = lab.execution;
  const sizeDef = getAnalyticsDefinition("position_size_buckets");
  const durDef = getAnalyticsDefinition("duration_buckets");
  const mfeDef = getAnalyticsDefinition("mfe_mae_scatter");
  const exitDef = getAnalyticsDefinition("exit_efficiency");

  const sizeScatter = {
    grid: { left: 48, right: 16, top: 16, bottom: 40 },
    tooltip: {
      trigger: "item",
      formatter: (p: { data: { symbol: string; result: string; tradeId: string; value: [number, number] } }) =>
        `${p.data.symbol} · ${p.data.result}<br/>Risk ${num(p.data.value[0], 3)}% · ${num(p.data.value[1])}R`,
    },
    xAxis: { type: "value", name: "Risk %", splitLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "value", name: "Realized R", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        name: "Trades",
        type: "scatter",
        symbolSize: 9,
        data: riskPoints.map((p) => ({
          value: [p.x, p.y],
          tradeId: p.tradeId,
          symbol: p.symbol,
          result: p.result,
          itemStyle: { color: p.y >= 0 ? C.pos : C.neg },
        })),
      },
      ...(regression
        ? [
            {
              name: "Trend",
              type: "line",
              data: regression.line,
              showSymbol: false,
              lineStyle: { type: "dashed", color: C.muted, width: 1.5 },
              tooltip: { show: false },
              z: 1,
            },
          ]
        : []),
    ],
  };

  const sizeBars = {
    grid: { left: 100, right: 16, top: 16, bottom: 32 },
    tooltip: {
      formatter: (p: { dataIndex: number }) => {
        const b = ex.position_size.buckets[p.dataIndex];
        return `${b.bucket}<br/>n=${b.n}<br/>Exp ${b.expectancy_r ?? "—"}R`;
      },
    },
    xAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "category", data: ex.position_size.buckets.map((b) => b.bucket), axisLabel: { fontSize: 11 } },
    series: [
      {
        type: "bar",
        data: ex.position_size.buckets.map((b) => ({
          value: b.expectancy_r ? Number(b.expectancy_r) : 0,
          itemStyle: { color: b.n < 5 ? C.muted : Number(b.expectancy_r) >= 0 ? C.pos : C.neg },
        })),
      },
    ],
  };

  const durData = ex.duration.buckets.map((b) => ({
    name: b.bucket,
    value: b.expectancy_r ? Number(b.expectancy_r) : 0,
  }));
  const durChart = {
    grid: { left: 44, right: 16, top: 16, bottom: 48 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: durData.map((d) => d.name), axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: "value", name: "Expectancy R", splitLine: { lineStyle: { color: C.line } } },
    series: [{ type: "bar", data: durData.map((d) => d.value) }],
  };

  const mfe = ex.mfe_mae;
  const exit = ex.exit_efficiency;
  const mfeInsight = generateMfeMaeInsight({
    coverageN: mfe.coverage_n ?? 0,
    totalN: ex.evidence.n,
    avgMfe: mfe.average_mfe_r ? Number(mfe.average_mfe_r) : null,
    avgMae: mfe.average_mae_r ? Number(mfe.average_mae_r) : null,
  });
  const exitInsight = generateExitEfficiencyInsight({
    coverageN: exit.coverage_n ?? 0,
    medianCapturePct: exit.median_capture_pct ? Number(exit.median_capture_pct) : null,
    insightText: exit.insight,
  });
  const mfeScatter =
    mfe.available && mfe.scatter?.length
      ? {
          grid: { left: 48, right: 16, top: 16, bottom: 40 },
          tooltip: {
            trigger: "item",
            formatter: (p: { data: { symbol: string; value: [number, number] } }) =>
              `${p.data.symbol}<br/>MAE ${num(p.data.value[0])}R · MFE ${num(p.data.value[1])}R`,
          },
          xAxis: { type: "value", name: "MAE (R)", splitLine: { lineStyle: { color: C.line } } },
          yAxis: { type: "value", name: "MFE (R)", splitLine: { lineStyle: { color: C.line } } },
          series: [
            {
              name: "Trades",
              type: "scatter",
              data: mfe.scatter.map((p) => ({
                value: [Number(p.mae_r ?? 0), Number(p.mfe_r ?? 0)],
                tradeId: p.trade_id,
                symbol: p.symbol,
                itemStyle: { color: p.result === "win" ? C.pos : p.result === "loss" ? C.neg : C.muted },
              })),
              symbolSize: 9,
            },
          ],
        }
      : null;

  const exitHistogram =
    captureBins.length > 0
      ? {
          grid: { left: 44, right: 16, top: 16, bottom: 40 },
          tooltip: { trigger: "axis" },
          xAxis: { type: "category", data: captureBins.map((b) => b.label), axisLabel: { fontSize: 10 } },
          yAxis: { type: "value", name: "Trades", splitLine: { lineStyle: { color: C.line } } },
          series: [
            {
              type: "bar",
              data: captureBins.map((b) => ({
                value: b.n,
                itemStyle: { color: C.muted },
              })),
            },
          ],
        }
      : null;

  const exitScatter =
    exit.available && exit.scatter?.length
      ? {
          grid: { left: 48, right: 16, top: 16, bottom: 40 },
          tooltip: {
            trigger: "item",
            formatter: (p: { data: { symbol: string; value: [number, number] } }) =>
              `${p.data.symbol}<br/>MFE ${num(p.data.value[0])}R · Realized ${num(p.data.value[1])}R`,
          },
          xAxis: { type: "value", name: "MFE R", splitLine: { lineStyle: { color: C.line } } },
          yAxis: { type: "value", name: "Realized R", splitLine: { lineStyle: { color: C.line } } },
          series: [
            {
              name: "Trades",
              type: "scatter",
              data: exit.scatter.map((p) => ({
                value: [Number(p.mfe_r ?? 0), Number(p.realized_r ?? 0)],
                tradeId: p.trade_id,
                symbol: p.symbol,
                itemStyle: { color: colorForPnl(C, p.realized_r) },
              })),
              symbolSize: 9,
            },
            {
              name: "Perfect capture",
              type: "line",
              data: [
                [0, 0],
                [Math.max(...exit.scatter.map((p) => Number(p.mfe_r ?? 0))), Math.max(...exit.scatter.map((p) => Number(p.mfe_r ?? 0)))],
              ],
              showSymbol: false,
              lineStyle: { type: "dashed", color: C.muted, width: 1 },
              tooltip: { show: false },
            },
          ],
        }
      : null;

  function openTrade(tradeId?: string) {
    if (tradeId) router.push(`/trades/${tradeId}`);
  }

  function handleScatterClick(params: { seriesName?: string; data?: unknown }) {
    const data = params.data as { tradeId?: string } | undefined;
    if (params.seriesName === "Trades" && data?.tradeId) {
      openTrade(data.tradeId);
    }
  }

  return (
    <>
      {showAdvanced && (
      <ChartCard title="Position size vs outcome" sampleSize={ex.evidence.n} evidenceLabel={ex.evidence.label} subtitle={ex.position_size.disclaimer} tier="deep_dive" interactive>
        {riskPoints.length < 2 ? (
          <Empty>Need at least two closed trades with risk data.</Empty>
        ) : (
          <>
            <ScatterQuadrantGuide
              xLabel="Risk %"
              yLabel="Realized R"
              quadrants={[
                { position: "Upper-left", meaning: "Lower risk with positive R." },
                { position: "Lower-right", meaning: "Higher risk with negative R — review sizing discipline." },
              ]}
            />
            <InteractiveChart option={sizeScatter} height={280} showHint={false} onChartClick={handleScatterClick} />
            {regression && (
              <p className="muted">
                Descriptive trend: {num(regression.slope, 3)} R per 1% risk (n={riskPoints.length}) — not a sizing rule.
              </p>
            )}
          </>
        )}
      </ChartCard>
      )}

      {showEssential && (
      <>
      <ChartCard title="Position size buckets" question={sizeDef?.primaryQuestion} tier={sizeDef?.tier} subtitle={`Bucketed expectancy by account risk % (${ex.position_size.method}).`} insight={sizeInsight}>
        {ex.position_size.buckets.every((b) => b.n === 0) ? (
          <Empty>No closed trades.</Empty>
        ) : (
          <InteractiveChart
            option={sizeBars}
            height={220}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || e.dataIndex == null) return;
              const bucket = ex.position_size.buckets[e.dataIndex];
              drill.openTrades(`${bucket.bucket} · n=${bucket.n}`);
            }}
          />
        )}
      </ChartCard>

      <ChartCard title="Duration buckets" question={durDef?.primaryQuestion} tier={durDef?.tier} subtitle="Holding time segments — historical association only." insight={durInsight} interactive>
        {ex.duration.buckets.every((b) => b.n === 0) ? (
          <Empty>No duration data.</Empty>
        ) : (
          <>
            <InteractiveChart
              option={durChart}
              height={240}
              showHint={false}
              onChartClick={(e) => {
                if (!drill || e.dataIndex == null) return;
                const bucket = ex.duration.buckets[e.dataIndex];
                drill.openTrades(`${bucket.bucket} · ${bucket.n} trades`);
              }}
            />
            <BucketTable rows={ex.duration.buckets} />
          </>
        )}
      </ChartCard>

      <ChartCard
        title={exitDef?.title ?? "Exit efficiency"}
        question={exitDef?.primaryQuestion}
        tier={exitDef?.tier}
        sampleSize={exit.coverage_n ?? 0}
        evidenceLabel={exit.evidence.label}
        insight={exitInsight}
        interactive
      >
        {!exit.available ? (
          <Empty>{exit.reason ?? "Exit efficiency unavailable without MFE data."}</Empty>
        ) : (
          <>
            <ExitEfficiencySummary medianCapturePct={exit.median_capture_pct ? Number(exit.median_capture_pct) : null} />
            <div className="kpis">
              <Stat label="Median capture" value={exit.median_capture_pct ? `${num(exit.median_capture_pct, 1)}%` : "—"} />
              <Stat label="Avg capture" value={exit.average_capture ? num(exit.average_capture, 2) : "—"} />
              <Stat label="Avg giveback" value={exit.average_giveback_r ? `${signed(exit.average_giveback_r)}R` : "—"} />
              <Stat label="Winners w/ MFE" value={String(exit.coverage_n ?? 0)} />
            </div>
            {exit.disclaimer && <p className="muted">{exit.disclaimer}</p>}
            {showAdvanced && exitHistogram && (
              <InteractiveChart
                option={exitHistogram}
                height={220}
                onChartClick={(e) => {
                  if (e.dataIndex == null) return;
                  const bin = captureBins[e.dataIndex];
                  if (!bin?.tradeIds.length) return;
                  if (bin.tradeIds.length === 1) {
                    openTrade(bin.tradeIds[0]);
                    return;
                  }
                  if (drill) {
                    drill.applyPatch({ result: "win" }, `${bin.label} MFE capture`);
                    drill.openTrades(`Winners · ${bin.label} capture (n=${bin.n})`);
                  }
                }}
              />
            )}
            {showAdvanced && exitScatter && <InteractiveChart option={exitScatter} height={280} showHint={false} onChartClick={handleScatterClick} />}
          </>
        )}
      </ChartCard>
      </>
      )}

      {showAdvanced && (
      <ChartCard
        title={mfeDef?.title ?? "MFE / MAE"}
        question={mfeDef?.primaryQuestion}
        tier={mfeDef?.tier}
        sampleSize={mfe.available ? mfe.coverage_n : ex.evidence.n}
        evidenceLabel={mfe.available ? mfe.evidence.label : mfe.evidence.label}
        insight={mfeInsight}
        interactive
      >
        {!mfe.available ? (
          <Empty>{mfe.reason ?? "MFE/MAE unavailable."}</Empty>
        ) : (
          <>
            <ScatterQuadrantGuide
              xLabel="MAE (max adverse excursion in R)"
              yLabel="MFE (max favorable excursion in R)"
              quadrants={[
                { position: "Top-left", meaning: "Large favorable move, limited adverse movement." },
                { position: "Bottom-right", meaning: "Large adverse movement with limited favorable move." },
              ]}
            />
            <div className="kpis">
              <Stat label="Coverage" value={`${mfe.coverage_n}/${ex.evidence.n} trades`} />
              <Stat label="Avg MFE" value={mfe.average_mfe_r ? `${signed(mfe.average_mfe_r)}R` : "—"} />
              <Stat label="Avg MAE" value={mfe.average_mae_r ? `${signed(mfe.average_mae_r)}R` : "—"} />
              <Stat label="Median MFE" value={mfe.median_mfe_r ? `${signed(mfe.median_mfe_r)}R` : "—"} />
              <Stat label="Median MAE" value={mfe.median_mae_r ? `${signed(mfe.median_mae_r)}R` : "—"} />
            </div>
            <p className="muted">{mfe.disclaimer}</p>
            {mfeScatter && <InteractiveChart option={mfeScatter} height={280} showHint={false} onChartClick={handleScatterClick} />}
            {mfe.sample_note && <p className="muted">{mfe.sample_note}</p>}
          </>
        )}
      </ChartCard>
      )}

      <style jsx>{`
        .muted {
          font-size: 13px;
          margin: 0 0 10px;
        }
        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 10px;
        }
      `}</style>
    </>
  );
}

function BucketTable({ rows }: { rows: LabBucketRow[] }) {
  return (
    <table className="bt">
      <thead>
        <tr>
          <th>Bucket</th>
          <th>n</th>
          <th>Win%</th>
          <th>Net R</th>
          <th>Exp R</th>
          <th>PF</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.bucket}>
            <td>{r.bucket}</td>
            <td>{r.n}</td>
            <td>{r.win_rate ? `${num(r.win_rate, 1)}%` : "—"}</td>
            <td>{r.net_r ? `${signed(r.net_r)}R` : "—"}</td>
            <td>{r.expectancy_r ? `${signed(r.expectancy_r)}R` : "—"}</td>
            <td>{r.profit_factor ? num(r.profit_factor) : "—"}</td>
          </tr>
        ))}
      </tbody>
      <style jsx>{`
        .bt {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-top: 12px;
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
      `}</style>
    </table>
  );
}
