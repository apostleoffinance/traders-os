"use client";

import uPlot, { type AlignedData, type Options } from "uplot";
import "uplot/dist/uPlot.min.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { areaColor, chartHeight, formatR, vizPalette } from "@/lib/visualization";

export type RollingPt = {
  trade_number: number;
  exit_at?: string;
  expectancy_r: string | null;
  win_rate: string | null;
};

/** uPlot rolling expectancy — Quant Lab parity with Performance/Risk time-series treatment. */
export function RollingExpectancy({
  points,
  height,
}: {
  points: RollingPt[];
  height?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const { resolved } = useTheme();
  const [hover, setHover] = useState<string | null>(null);
  const chartH = height ?? chartHeight("hero");

  const seriesData = useMemo(() => {
    const valid = points.filter((p) => p.expectancy_r != null);
    return {
      xs: valid.map((p) => p.trade_number),
      ys: valid.map((p) => Number(p.expectancy_r)),
      pts: valid,
    };
  }, [points]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || seriesData.xs.length < 2) return;

    const C = vizPalette();
    const width = el.clientWidth || el.parentElement?.clientWidth || 640;

    const opts: Options = {
      width,
      height: chartH,
      cursor: { drag: { x: true, y: false }, points: { show: false } },
      scales: {
        x: { time: false },
      },
      axes: [
        {
          stroke: C.muted,
          grid: { show: true, stroke: C.line, width: 1 },
          ticks: { stroke: C.line },
          font: "11px sans-serif",
          values: (_u, splits) => splits.map((s) => `#${Math.round(s)}`),
        },
        {
          stroke: C.muted,
          grid: { show: true, stroke: C.line, width: 1 },
          ticks: { stroke: C.line },
          font: "11px sans-serif",
          size: 52,
          values: (_u, splits) => splits.map((v) => formatR(v)),
        },
      ],
      series: [
        {},
        {
          label: "Expectancy R",
          stroke: C.pos,
          width: 2,
          fill: areaColor("pos", 0.12),
          points: { show: false },
        },
      ],
      hooks: {
        setCursor: [
          (u) => {
            const idx = u.cursor.idx;
            if (idx == null || idx < 0 || idx >= seriesData.pts.length) {
              setHover(null);
              return;
            }
            const p = seriesData.pts[idx];
            const wr = p.win_rate != null ? `${Number(p.win_rate).toFixed(1)}% WR` : "WR —";
            setHover(`Trade #${p.trade_number} · ${formatR(Number(p.expectancy_r))} · ${wr}`);
          },
        ],
      },
    };

    const data: AlignedData = [seriesData.xs, seriesData.ys];
    const plot = new uPlot(opts, data, el);
    plotRef.current = plot;

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0 && plotRef.current) plotRef.current.setSize({ width: w, height: chartH });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [seriesData, chartH, resolved]);

  if (seriesData.xs.length < 2) return null;

  return (
    <div className="rolling" role="img" aria-label="Rolling expectancy over trade sequence">
      <div ref={hostRef} className="plot" style={{ height: chartH }} />
      {hover ? (
        <p className="hover" aria-live="polite">
          {hover}
        </p>
      ) : (
        <p className="hover muted">Hover for rolling expectancy and win rate</p>
      )}
      <style jsx>{`
        .rolling {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: hidden;
        }
        .plot {
          width: 100%;
          min-height: 200px;
        }
        .plot :global(.uplot) {
          margin: 0;
          font-family: inherit;
        }
        .hover {
          margin: 8px 0 0;
          font-size: 12px;
          min-height: 1.2em;
        }
        .hover.muted {
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
