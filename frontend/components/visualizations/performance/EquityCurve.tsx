"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import uPlot, { type AlignedData, type Options } from "uplot";
import "uplot/dist/uPlot.min.css";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { filterForSingleDay } from "@/lib/analytics-drilldown";
import type { EquityMarker, EquityPt } from "@/lib/analytics";
import {
  areaColor,
  breakpointFromWidth,
  chartHeight,
  equityTooltipLine,
  formatAxisMoney,
  formatDateShort,
  type EquityRangePreset,
  vizPalette,
} from "@/lib/visualization";
import { money } from "@/lib/format";

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

function sliceByRange(curve: EquityPt[], preset: EquityRangePreset): EquityPt[] {
  if (curve.length === 0 || preset === "ALL") return curve;
  const latest = parseMs(curve[curve.length - 1].at);
  const start = rangeStartMs(preset, latest);
  if (start == null) return curve;
  // Do not fall back to unrelated last-N points — that fakes the selected window.
  return curve.filter((p) => parseMs(p.at) >= start);
}

export function EquityCurve({
  curve,
  markers = [],
  currency,
  height,
  defaultRange = "ALL",
  showRangeControls = true,
  metric = "equity",
  compact = false,
}: {
  curve: EquityPt[];
  markers?: EquityMarker[];
  currency: string;
  height?: number;
  defaultRange?: EquityRangePreset;
  showRangeControls?: boolean;
  /** Net equity ($) or cumulative R — Performance tab uses both. */
  metric?: "equity" | "cumulative_r";
  /** Tighter plot padding / hover chrome for Command Center. */
  compact?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const { resolved } = useTheme();
  const drill = useOptionalAnalyticsDrilldown();
  const router = useRouter();
  const [range, setRange] = useState<EquityRangePreset>(defaultRange);
  const [hover, setHover] = useState<string | null>(null);
  const [vpWidth, setVpWidth] = useState(1024);

  useEffect(() => {
    setRange(defaultRange);
  }, [defaultRange]);

  useEffect(() => {
    const sync = () => setVpWidth(window.innerWidth);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const chartH =
    height ??
    chartHeight(compact ? "compact" : "hero", breakpointFromWidth(vpWidth));
  const sliced = useMemo(() => sliceByRange(curve, range), [curve, range]);

  const seriesData = useMemo(() => {
    const xs = sliced.map((p) => parseMs(p.at) / 1000);
    const ys = sliced.map((p) =>
      metric === "cumulative_r" ? Number(p.cumulative_r) : Number(p.equity),
    );
    return { xs, ys, sliced } as const;
  }, [sliced, metric]);

  const markerIndex = useMemo(() => {
    const byAt = new Map(sliced.map((p, i) => [p.at.slice(0, 10), i]));
    return markers
      .map((m) => {
        const i = byAt.get(m.at.slice(0, 10));
        if (i == null) return null;
        const y =
          metric === "cumulative_r" ? Number(sliced[i].cumulative_r) : Number(sliced[i].equity);
        return { ...m, index: i, y };
      })
      .filter((m): m is EquityMarker & { index: number; y: number } => m != null);
  }, [markers, sliced, metric]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || seriesData.xs.length < 2) return;

    const C = vizPalette();
    const width = el.clientWidth || el.parentElement?.clientWidth || 640;

    const opts: Options = {
      width,
      height: chartH,
      padding: compact ? [6, 8, 0, 0] : [10, 10, 0, 0],
      cursor: {
        drag: { x: true, y: false },
        points: { show: seriesData.xs.length <= 12 },
      },
      scales: {
        x: {
          time: true,
          range: (_u, dataMin, dataMax) => [dataMin, dataMax],
        },
        y: {
          range: (_u, dataMin, dataMax) => {
            const lo = Number.isFinite(dataMin) ? dataMin : 0;
            const hi = Number.isFinite(dataMax) ? dataMax : 1;
            const span = hi - lo;
            const pad = span === 0 ? Math.max(Math.abs(hi) * 0.02, 1) : span * (compact ? 0.04 : 0.06);
            return [lo - pad, hi + pad];
          },
        },
      },
      axes: [
        {
          stroke: C.muted,
          grid: { show: true, stroke: C.line, width: 1 },
          ticks: { stroke: C.line },
          font: "11px sans-serif",
          size: compact ? 36 : 44,
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
          size: compact ? 48 : 56,
          values: (_u, splits) =>
            splits.map((v) =>
              metric === "cumulative_r"
                ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}R`
                : formatAxisMoney(v, currency).replace(/\s/g, ""),
            ),
        },
      ],
      series: [
        {},
        {
          label: metric === "cumulative_r" ? "Cumulative R" : "Equity",
          stroke: C.pos,
          width: 2,
          fill: areaColor("pos", 0.16),
          points: { show: seriesData.xs.length <= 12, size: 3, fill: C.pos },
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
              metric === "cumulative_r"
                ? `${formatDateShort(p.at)} · ${Number(p.cumulative_r) >= 0 ? "+" : ""}${Number(p.cumulative_r).toFixed(2)}R`
                : equityTooltipLine({
                    date: p.at,
                    equity: Number(p.equity),
                    currency,
                  }),
            );
          },
        ],
      },
    };

    const data: AlignedData = [seriesData.xs, seriesData.ys];
    const plot = new uPlot(opts, data, el);
    plotRef.current = plot;

    const onClick = (e: MouseEvent) => {
      const u = plotRef.current;
      if (!u) return;
      const left = u.cursor.left;
      if (left == null || left < 0) return;
      const idx = u.posToIdx(left);
      if (idx < 0 || idx >= seriesData.sliced.length) return;
      const day = formatDateShort(seriesData.sliced[idx].at);
      const hit = markerIndex.find((m) => m.index === idx);
      if (hit?.trade_id && e.metaKey) {
        router.push(`/trades/${hit.trade_id}`);
        return;
      }
      if (drill) {
        drill.applyPatch(filterForSingleDay(day), day);
        drill.openTrades(`Trades on ${day}`);
      }
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
  }, [seriesData, chartH, currency, resolved, drill, router, markerIndex, metric, compact]);

  if (curve.length < 2) return null;
  if (sliced.length < 2) {
    return (
      <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>
        Not enough observations in this period for a curve.
      </p>
    );
  }

  return (
    <div className="equity-curve" role="img" aria-label={metric === "cumulative_r" ? "Cumulative R equity curve" : "Equity curve"}>
      {showRangeControls ? (
        <div className="ranges" role="group" aria-label="Equity time range">
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
        <p className="hover muted">
          {compact ? "Hover a point for details" : "Hover for equity · click a day to inspect trades"}
        </p>
      )}
      {markerIndex.length > 0 ? (
        <p className="hint muted">
          Latest {money(seriesData.ys[seriesData.ys.length - 1], currency)} · {markerIndex.length} trade markers in view
        </p>
      ) : null}
      <style jsx>{`
        .equity-curve {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          min-height: 0;
          height: 100%;
          flex: 1 1 auto;
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
          min-height: 0;
          height: 100%;
          flex: 1 1 auto;
        }
        .plot :global(.uplot) {
          margin: 0;
          font-family: inherit;
        }
        .hover {
          margin: 6px 0 0;
          font-size: 12px;
          color: var(--text-primary);
          min-height: 1.15em;
        }
        .hover.muted,
        .hint {
          color: var(--text-muted);
        }
        .hint {
          margin: 4px 0 0;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}
