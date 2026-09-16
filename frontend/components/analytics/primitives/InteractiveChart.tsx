"use client";

import dynamic from "next/dynamic";
import type { InteractiveChartProps } from "./InteractiveChartEcharts";

const InteractiveChartEcharts = dynamic(
  () => import("./InteractiveChartEcharts").then((m) => m.InteractiveChartEcharts),
  {
    ssr: false,
    loading: () => (
      <div className="chart-skel" role="status" aria-live="polite" aria-busy="true">
        <span className="sr">Loading chart…</span>
        <style jsx>{`
          .chart-skel {
            width: 100%;
            max-width: 100%;
            min-height: 200px;
            border-radius: 8px;
            background: color-mix(in srgb, var(--surface-2, var(--surface)) 70%, transparent);
          }
          .sr {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            border: 0;
          }
        `}</style>
      </div>
    ),
  },
);

/** Lazily loads ECharts — keeps the analytics/quant initial bundle lighter. */
export function InteractiveChart(props: InteractiveChartProps) {
  return <InteractiveChartEcharts {...props} />;
}

export type { InteractiveChartProps, ChartClickEvent } from "./InteractiveChartEcharts";
