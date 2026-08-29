"use client";

import { useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import ReactECharts from "echarts-for-react";
import { useLiveChart } from "@/components/analytics/Charts";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { filterForDateRange, filterForSingleDay } from "@/lib/analytics-drilldown";
import type { EquityMarker, EquityPt } from "@/lib/analytics";
import { money, num } from "@/lib/format";

type EqMode = "net_pnl" | "gross_pnl" | "r_multiple";

type MarkerPoint = EquityMarker & { index: number; y: number };

function markerColor(result: string, C: ReturnType<typeof useLiveChart>["C"]) {
  if (result === "win") return C.pos;
  if (result === "loss") return C.neg;
  return C.muted;
}

function buildMarkerPoints(
  curve: EquityPt[],
  markers: EquityMarker[],
  values: number[],
): MarkerPoint[] {
  const atIndex = new Map(curve.map((p, i) => [p.at, i]));
  return markers
    .map((m) => {
      const index = atIndex.get(m.at);
      if (index == null || index < 1) return null;
      return { ...m, index, y: values[index] };
    })
    .filter((m): m is MarkerPoint => m != null);
}

export function EquityInteractiveChart({
  netCurve,
  grossCurve,
  markers,
  mode,
  currency,
  height = 320,
}: {
  netCurve: EquityPt[];
  grossCurve: EquityPt[];
  markers: EquityMarker[];
  mode: EqMode;
  currency: string;
  height?: number;
}) {
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const router = useRouter();
  const chartRef = useRef<ReactECharts>(null);

  const activeCurve = mode === "gross_pnl" ? grossCurve : netCurve;
  const labels = activeCurve.map((p) => p.at.slice(0, 10));
  const values = useMemo(() => {
    if (mode === "r_multiple") return netCurve.map((p) => Number(p.cumulative_r));
    return activeCurve.map((p) => Number(p.equity));
  }, [mode, activeCurve, netCurve]);

  const markerPoints = useMemo(() => buildMarkerPoints(netCurve, markers, values), [netCurve, markers, values]);

  const option = useMemo(
    () => ({
      grid: { left: 52, right: 16, top: 36, bottom: 56 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross" },
      },
      toolbox: {
        right: 8,
        feature: {
          dataZoom: { yAxisIndex: "none", title: { zoom: "Zoom", back: "Reset zoom" } },
          brush: { type: ["lineX", "clear"], title: { lineX: "Select range", clear: "Clear" } },
        },
      },
      brush: {
        toolbox: ["lineX", "clear"],
        xAxisIndex: 0,
        brushStyle: { borderWidth: 1, color: "rgba(120, 140, 180, 0.12)" },
      },
      dataZoom: [
        { type: "inside", xAxisIndex: 0 },
        { type: "slider", xAxisIndex: 0, height: 18, bottom: 6 },
      ],
      xAxis: { type: "category", data: labels, axisLabel: { fontSize: 10 } },
      yAxis: {
        type: "value",
        name: mode === "r_multiple" ? "Cumulative R" : "Equity",
        splitLine: { lineStyle: { color: C.line } },
      },
      series: [
        {
          name: mode === "r_multiple" ? "Cumulative R" : mode === "gross_pnl" ? "Gross equity" : "Net equity",
          type: "line",
          showSymbol: false,
          data: values,
          lineStyle: { width: 1.8, color: mode === "r_multiple" ? C.pos : C.blue },
          areaStyle:
            mode === "r_multiple"
              ? undefined
              : { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(59,130,246,0.12)" }, { offset: 1, color: "rgba(59,130,246,0)" }] } },
          z: 1,
        },
        {
          name: "Trades",
          type: "scatter",
          data: markerPoints.map((m) => ({
            value: [m.index, m.y],
            tradeId: m.trade_id,
            symbol: m.symbol,
            result: m.result,
            net_pnl: m.net_pnl,
            r_multiple: m.r_multiple,
            itemStyle: { color: markerColor(m.result, C) },
          })),
          symbolSize: 9,
          z: 3,
        },
      ],
    }),
    [C, labels, markerPoints, mode, values],
  );

  function handleBrushEnd(params: { areas?: { coordRange?: number[]; brushType?: string }[] }) {
    if (!drill || !params.areas?.length) return;
    const area = params.areas[0];
    if (area.brushType !== "lineX" || !area.coordRange) return;
    const [rawStart, rawEnd] = area.coordRange;
    const startIdx = Math.max(0, Math.floor(Math.min(rawStart, rawEnd)));
    const endIdx = Math.min(labels.length - 1, Math.ceil(Math.max(rawStart, rawEnd)));
    const from = labels[startIdx];
    const to = labels[endIdx];
    if (!from || !to) return;
    const label = from === to ? from : `${from} → ${to}`;
    drill.applyPatch(filterForDateRange(from, to), label);
    drill.openTrades(`Trades · ${label}`);
    chartRef.current?.getEchartsInstance().dispatchAction({ type: "brush", areas: [] });
  }

  function handleClick(params: {
    seriesName?: string;
    data?: { tradeId?: string };
    dataIndex?: number;
  }) {
    if (params.seriesName === "Trades") {
      if (params.data?.tradeId) router.push(`/trades/${params.data.tradeId}`);
      return;
    }
    if (!drill || params.dataIndex == null) return;
    const day = labels[params.dataIndex];
    if (!day) return;
    drill.applyPatch(filterForSingleDay(day), day);
    drill.openTrades(`Trades on ${day}`);
  }

  return (
    <div className="equity-chart">
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height }}
        notMerge
        lazyUpdate
        onEvents={{
          brushEnd: handleBrushEnd,
          click: handleClick,
        }}
      />
      <p className="hint muted">
        Drag to brush a date range · scroll to zoom · click a trade dot to open the journal entry
      </p>
      <style jsx>{`
        .equity-chart {
          width: 100%;
        }
        .hint {
          font-size: 11px;
          margin: 6px 0 0;
        }
      `}</style>
    </div>
  );
}

export function UnderwaterChart({
  curve,
  currency,
  height = 240,
}: {
  curve: { at: string; drawdown: string; drawdown_pct: string; equity: string; peak: string }[];
  currency: string;
  height?: number;
}) {
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const chartRef = useRef<ReactECharts>(null);

  if (curve.length < 2) return null;

  const labels = curve.map((p) => p.at.slice(0, 10));
  const underwater = curve.map((p) => -Number(p.drawdown));

  const option = {
    grid: { left: 52, right: 16, top: 28, bottom: 56 },
    tooltip: {
      trigger: "axis",
      formatter: (items: { dataIndex: number }[]) => {
        const i = items[0]?.dataIndex ?? 0;
        const p = curve[i];
        if (!p) return "";
        return `${labels[i]}<br/>Drawdown ${money(p.drawdown, currency)} (${num(p.drawdown_pct, 1)}%)<br/>Equity ${money(p.equity, currency)}`;
      },
    },
    toolbox: {
      right: 8,
      feature: {
        dataZoom: { yAxisIndex: "none" },
        brush: { type: ["lineX", "clear"] },
      },
    },
    brush: { toolbox: ["lineX", "clear"], xAxisIndex: 0 },
    dataZoom: [
      { type: "inside", xAxisIndex: 0 },
      { type: "slider", xAxisIndex: 0, height: 18, bottom: 6 },
    ],
    xAxis: { type: "category", data: labels, axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", name: "Underwater", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "line",
        data: underwater,
        showSymbol: false,
        lineStyle: { color: C.neg, width: 1.5 },
        areaStyle: { color: "rgba(239, 68, 68, 0.18)" },
      },
    ],
  };

  function handleBrushEnd(params: { areas?: { coordRange?: number[]; brushType?: string }[] }) {
    if (!drill || !params.areas?.length) return;
    const area = params.areas[0];
    if (area.brushType !== "lineX" || !area.coordRange) return;
    const [rawStart, rawEnd] = area.coordRange;
    const startIdx = Math.max(0, Math.floor(Math.min(rawStart, rawEnd)));
    const endIdx = Math.min(labels.length - 1, Math.ceil(Math.max(rawStart, rawEnd)));
    const from = labels[startIdx];
    const to = labels[endIdx];
    if (!from || !to) return;
    const label = from === to ? from : `${from} → ${to}`;
    drill.applyPatch(filterForDateRange(from, to), label);
    drill.openTrades(`Drawdown period · ${label}`);
    chartRef.current?.getEchartsInstance().dispatchAction({ type: "brush", areas: [] });
  }

  function handleClick(params: { dataIndex?: number }) {
    if (!drill || params.dataIndex == null) return;
    const day = labels[params.dataIndex];
    if (!day) return;
    drill.applyPatch(filterForSingleDay(day), day);
    drill.openTrades(`Trades on ${day}`);
  }

  return (
    <div className="underwater">
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height }}
        notMerge
        lazyUpdate
        onEvents={{
          brushEnd: handleBrushEnd,
          click: handleClick,
        }}
      />
      <p className="hint muted">Underwater equity · brush or click a point to inspect trades in that window</p>
      <style jsx>{`
        .underwater {
          width: 100%;
        }
        .hint {
          font-size: 11px;
          margin: 6px 0 0;
        }
      `}</style>
    </div>
  );
}
