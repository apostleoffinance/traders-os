"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import { CHART_INTERACTIVE_HINT } from "@/lib/chart-constants";
import {
  breakpointFromWidth,
  chartHeight,
  simplifyAxes,
  type Breakpoint,
} from "@/lib/visualization";

export type ChartClickEvent = {
  dataIndex?: number;
  name?: string;
  seriesName?: string;
  componentType?: string;
  data?: unknown;
};

export type InteractiveChartProps = {
  option: object;
  height?: number;
  onChartClick?: (event: ChartClickEvent) => void;
  className?: string;
  showHint?: boolean;
  /** Accessible name for the chart region */
  ariaLabel?: string;
  /** Density preset when height is omitted */
  size?: "hero" | "standard" | "compact";
};

function adaptOptionForBreakpoint(option: object, bp: Breakpoint): object {
  if (!simplifyAxes(bp)) {
    return {
      ...option,
      tooltip: { ...((option as { tooltip?: object }).tooltip ?? {}), confine: true },
    };
  }

  const src = option as {
    grid?: Record<string, unknown> | Record<string, unknown>[];
    xAxis?: Record<string, unknown> | Record<string, unknown>[];
    yAxis?: Record<string, unknown> | Record<string, unknown>[];
    tooltip?: object;
  };

  const slimAxis = (axis: Record<string, unknown> | undefined) => {
    if (!axis) return axis;
    const prevLabel = (axis.axisLabel as Record<string, unknown> | undefined) ?? {};
    return {
      ...axis,
      name: undefined,
      axisLabel: {
        ...prevLabel,
        fontSize: 9,
        hideOverlap: true,
      },
    };
  };

  const mapAxes = (axes: typeof src.xAxis) => {
    if (!axes) return axes;
    if (Array.isArray(axes)) return axes.map((a) => slimAxis(a) ?? a);
    return slimAxis(axes);
  };

  const grid = src.grid
    ? Array.isArray(src.grid)
      ? src.grid.map((g) => ({ ...g, left: Math.min(Number(g.left ?? 48), 36), right: 8, bottom: Math.min(Number(g.bottom ?? 48), 36) }))
      : {
          ...src.grid,
          left: Math.min(Number(src.grid.left ?? 48), 36),
          right: 8,
          bottom: Math.min(Number(src.grid.bottom ?? 48), 36),
        }
    : { left: 36, right: 8, top: 28, bottom: 36 };

  return {
    ...option,
    grid,
    xAxis: mapAxes(src.xAxis),
    yAxis: mapAxes(src.yAxis),
    tooltip: { ...(src.tooltip ?? {}), confine: true },
  };
}

export function InteractiveChartEcharts({
  option,
  height,
  onChartClick,
  className,
  showHint = true,
  ariaLabel,
  size = "standard",
}: InteractiveChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [bp, setBp] = useState<Breakpoint>("desktop");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBp(breakpointFromWidth(el.clientWidth || window.innerWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const resolvedHeight = height ?? chartHeight(size, bp);
  const adapted = useMemo(() => adaptOptionForBreakpoint(option, bp), [option, bp]);

  return (
    <div
      ref={wrapRef}
      className={className ? `chart-wrap ${className}` : "chart-wrap"}
      role="img"
      aria-label={ariaLabel ?? "Interactive chart"}
    >
      <ReactECharts
        option={adapted}
        style={{ height: resolvedHeight, width: "100%", maxWidth: "100%" }}
        notMerge
        lazyUpdate
        onEvents={
          onChartClick
            ? {
                click: (params: ChartClickEvent) => onChartClick(params),
              }
            : undefined
        }
      />
      {onChartClick && showHint && <p className="click-hint muted">{CHART_INTERACTIVE_HINT}</p>}
      <style jsx>{`
        .chart-wrap {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: hidden;
        }
        .click-hint {
          font-size: 11px;
          margin: 8px 0 0;
        }
      `}</style>
    </div>
  );
}
