"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useLiveChart } from "@/components/analytics/Charts";
import { num } from "@/lib/format";

export function ReportExecutionSection({
  execution,
  decisionQuality,
}: {
  execution: Record<string, unknown>;
  decisionQuality: Record<string, unknown>;
}) {
  const { C } = useLiveChart();
  const mfe = execution.mfe_mae as { available?: boolean; scatter?: { trade_id: string; mfe_r: string; mae_r: string; result: string }[] } | undefined;
  const exit = execution.exit_efficiency as { available?: boolean; median_capture_pct?: string } | undefined;
  const scatterPts = mfe?.scatter ?? [];

  const mfeScatter = scatterPts.length
    ? {
        grid: { left: 52, right: 16, top: 24, bottom: 40 },
        tooltip: { trigger: "item" },
        xAxis: { type: "value", name: "MAE (R)", splitLine: { lineStyle: { color: C.line } } },
        yAxis: { type: "value", name: "MFE (R)", splitLine: { lineStyle: { color: C.line } } },
        series: [
          {
            type: "scatter",
            symbolSize: 10,
            data: scatterPts.map((p) => ({
              value: [Number(p.mae_r), Number(p.mfe_r)],
              tradeId: p.trade_id,
              itemStyle: { color: p.result === "win" ? C.pos : p.result === "loss" ? C.neg : C.muted },
            })),
          },
        ],
      }
    : null;

  const dq = decisionQuality.counts as Record<string, number> | undefined;
  const dqLabels = decisionQuality.labels as Record<string, string> | undefined;

  return (
    <>
      <h2 className="section-title">Execution quality</h2>
      {mfeScatter && (
        <ChartCard title="MFE / MAE scatter" subtitle="Maximum favorable vs adverse excursion per trade" interactive>
          <InteractiveChart option={mfeScatter} height={280} showHint={false} />
        </ChartCard>
      )}
      {exit?.available && (
        <ChartCard title="Exit efficiency">
          <p className="stat">Median MFE capture: {exit.median_capture_pct ? `${num(exit.median_capture_pct, 1)}%` : "—"}</p>
          <p className="hint">How much of favorable movement was captured at exit.</p>
        </ChartCard>
      )}
      {dq && dqLabels && (
        <ChartCard title="Process vs outcome">
          <ul className="dq-list">
            {Object.entries(dq).map(([k, v]) => (
              <li key={k}>
                <span>{dqLabels[k] ?? k}</span>
                <strong>{v}</strong>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 16px;
        }
        .stat {
          font-family: var(--font-mono), monospace;
          font-size: 22px;
        }
        .hint {
          font-size: 13px;
          color: var(--muted);
        }
        .dq-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .dq-list li {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
        }
      `}</style>
    </>
  );
}
