"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import uPlot, { type AlignedData, type Options } from "uplot";
import "uplot/dist/uPlot.min.css";
import { useTheme } from "@/components/ThemeProvider";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { filterForDateRange, filterForSingleDay } from "@/lib/analytics-drilldown";
import {
  areaColor,
  chartHeight,
  drawdownTooltipLine,
  formatAxisMoney,
  formatDateShort,
  type EquityRangePreset,
  vizPalette,
} from "@/lib/visualization";

type DdPt = { at: string; drawdown: string; drawdown_pct: string; equity: string; peak: string };

const RANGE_OPTIONS: { id: EquityRangePreset; label: string }[] = [
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "6M", label: "6M" },
  { id: "YTD", label: "YTD" },
  { id: "1Y", label: "1Y" },
  { id: "ALL", label: "ALL" },
];

function parseMs(iso: string): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function rangeStartMs(preset: EquityRangePreset, latestMs: number): number | null {
  if (preset === "ALL") return null;
  const d = new Date(latestMs);
  if (preset === "YTD") return Date.UTC(d.getUTCFullYear(), 0, 1);
  const days = preset === "1M" ? 31 : preset === "3M" ? 92 : preset === "6M" ? 183 : 365;
  return latestMs - days * 24 * 60 * 60 * 1000;
}

function sliceByRange(curve: DdPt[], preset: EquityRangePreset): DdPt[] {
  if (curve.length < 2 || preset === "ALL") return curve;
  const latest = parseMs(curve[curve.length - 1].at);
  const start = rangeStartMs(preset, latest);
  if (start == null) return curve;
  const filtered = curve.filter((p) => parseMs(p.at) >= start);
  return filtered.length >= 2 ? filtered : curve.slice(-2);
}

/** uPlot underwater / drawdown depth curve for Risk tab. */
export function UnderwaterCurve({
  curve,
  currency,
  height,
  defaultRange = "ALL",
  showRangeControls = true,
}: {
  curve: DdPt[];
  currency: string;
  height?: number;
  defaultRange?: EquityRangePreset;
  showRangeControls?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const { resolved } = useTheme();
  const drill = useOptionalAnalyticsDrilldown();
  const [range, setRange] = useState<EquityRangePreset>(defaultRange);
  const [hover, setHover] = useState<string | null>(null);

  const chartH = height ?? chartHeight("standard");
  const sliced = useMemo(() => sliceByRange(curve, range), [curve, range]);

  const seriesData = useMemo(() => {
    const xs = sliced.map((p) => parseMs(p.at) / 1000);
    // Negative depth so the area fills "under water"
    const ys = sliced.map((p) => -Math.abs(Number(p.drawdown)));
    return { xs, ys, sliced } as const;
  }, [sliced]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || seriesData.xs.length < 2) return;

    const C = vizPalette();
    const width = el.clientWidth || el.parentElement?.clientWidth || 640;

    const opts: Options = {
      width,
      height: chartH,
      cursor: {
        drag: { x: true, y: false },
        points: { show: false },
      },
      scales: {
        x: { time: true },
      },
      axes: [
        {
          stroke: C.muted,
          grid: { show: true, stroke: C.line, width: 1 },
          ticks: { stroke: C.line },
          font: "11px sans-serif",
          values: (_u, splits) =>
            splits.map((s) => {
              const d = new Date(s * 1000);
              return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
            }),
        },
        {
          stroke: C.muted,
          grid: { show: true, stroke: C.line, width: 1 },
          ticks: { stroke: C.line },
          font: "11px sans-serif",
          size: 56,
          values: (_u, splits) => splits.map((v) => formatAxisMoney(v, currency).replace(/\s/g, "")),
        },
      ],
      series: [
        {},
        {
          label: "Underwater",
          stroke: C.neg,
          width: 2,
          fill: areaColor("neg", 0.2),
          points: { show: false },
        },
      ],
      hooks: {
        setCursor: [
          (u) => {
            const idx = u.cursor.idx;
            if (idx == null || idx < 0 || idx >= seriesData.sliced.length) {
              setHover(null);
              return;
            }
            const p = seriesData.sliced[idx];
            setHover(
              drawdownTooltipLine({
                date: p.at,
                drawdown: Number(p.drawdown),
                drawdownPct: Number(p.drawdown_pct),
                currency,
              }),
            );
          },
        ],
        setSelect: [
          (u) => {
            if (!drill) return;
            const left = u.select.left;
            const widthSel = u.select.width;
            if (widthSel < 8) return;
            const i0 = u.posToIdx(left);
            const i1 = u.posToIdx(left + widthSel);
            if (i0 < 0 || i1 < 0) return;
            const a = Math.min(i0, i1);
            const b = Math.max(i0, i1);
            const from = formatDateShort(seriesData.sliced[a].at);
            const to = formatDateShort(seriesData.sliced[b].at);
            const label = from === to ? from : `${from} → ${to}`;
            drill.applyPatch(filterForDateRange(from, to), label);
            drill.openTrades(`Drawdown period · ${label}`);
            u.setSelect({ left: 0, width: 0, top: 0, height: 0 }, false);
          },
        ],
      },
    };

    const data: AlignedData = [seriesData.xs, seriesData.ys];
    const plot = new uPlot(opts, data, el);
    plotRef.current = plot;

    const onClick = () => {
      const u = plotRef.current;
      if (!u || !drill) return;
      if (u.select.width > 8) return;
      const left = u.cursor.left;
      if (left == null || left < 0) return;
      const idx = u.posToIdx(left);
      if (idx < 0 || idx >= seriesData.sliced.length) return;
      const day = formatDateShort(seriesData.sliced[idx].at);
      drill.applyPatch(filterForSingleDay(day), day);
      drill.openTrades(`Trades on ${day}`);
    };
    el.addEventListener("click", onClick);

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0 && plotRef.current) plotRef.current.setSize({ width: w, height: chartH });
    });
    ro.observe(el);

    return () => {
      el.removeEventListener("click", onClick);
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [seriesData, chartH, currency, resolved, drill]);

  if (curve.length < 2) return null;

  return (
    <div className="underwater-curve" role="img" aria-label="Underwater equity drawdown curve">
      {showRangeControls ? (
        <div className="ranges" role="group" aria-label="Underwater time range">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={range === r.id ? "on" : ""}
              aria-pressed={range === r.id}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={hostRef} className="plot" style={{ height: chartH }} />
      {hover ? (
        <p className="hover" aria-live="polite">
          {hover}
        </p>
      ) : (
        <p className="hover muted">Hover for drawdown · drag to select a window · click a day</p>
      )}
      <style jsx>{`
        .underwater-curve {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: hidden;
        }
        .ranges {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 8px;
        }
        .ranges button {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
        }
        .ranges button.on {
          background: var(--accent);
          color: var(--accent-contrast, #fff);
          border-color: var(--accent);
        }
        .plot {
          width: 100%;
          min-height: 180px;
        }
        .plot :global(.uplot) {
          margin: 0;
          font-family: inherit;
        }
        .hover {
          margin: 8px 0 0;
          font-size: 12px;
          color: var(--text-primary);
          min-height: 1.2em;
        }
        .hover.muted {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
