"use client";

import ReactECharts from "echarts-for-react";
import { CHART_INTERACTIVE_HINT } from "@/lib/chart-constants";

type ClickEvent = {
  dataIndex?: number;
  name?: string;
  seriesName?: string;
  componentType?: string;
  data?: unknown;
};

export function InteractiveChart({
  option,
  height = 260,
  onChartClick,
  className,
  showHint = true,
}: {
  option: object;
  height?: number;
  onChartClick?: (event: ClickEvent) => void;
  className?: string;
  showHint?: boolean;
}) {
  const interactiveOption = {
    ...option,
    tooltip: { ...((option as { tooltip?: object }).tooltip ?? {}), confine: true },
  };

  return (
    <div className={className ?? "chart-wrap"}>
      <ReactECharts
        option={interactiveOption}
        style={{ height }}
        notMerge
        lazyUpdate
        onEvents={
          onChartClick
            ? {
                click: (params: ClickEvent) => onChartClick(params),
              }
            : undefined
        }
      />
      {onChartClick && showHint && <p className="click-hint muted">{CHART_INTERACTIVE_HINT}</p>}
      <style jsx>{`
        .chart-wrap {
          width: 100%;
        }
        .click-hint {
          font-size: 11px;
          margin: 6px 0 0;
        }
      `}</style>
    </div>
  );
}
