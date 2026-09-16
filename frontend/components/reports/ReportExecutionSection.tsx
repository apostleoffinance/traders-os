"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useLiveChart } from "@/components/analytics/Charts";
import { ReportChapter } from "@/components/reports/story/ReportChapter";
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

  const capture = exit?.median_capture_pct != null ? Number(exit.median_capture_pct) : null;
  const takeaway =
    capture != null
      ? `Median favorable-move capture at exit: ${num(capture, 1)}%. Review MFE/MAE when capture is low on winners.`
      : "Exit efficiency needs more trades with MFE recorded.";

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
    <ReportChapter id="execution" title="5. Execution" question="How well did I manage trades once in?" takeaway={takeaway}>
      {exit?.available && (
        <ChartCard title="Exit efficiency" question="Am I leaving money on the table?">
          <p className="stat">Median MFE capture: {exit.median_capture_pct ? `${num(exit.median_capture_pct, 1)}%` : "—"}</p>
          <p className="hint">Share of favorable excursion captured at exit — not a forecast.</p>
        </ChartCard>
      )}
      {mfeScatter && (
        <ChartCard title="MFE / MAE scatter" subtitle="Maximum favorable vs adverse excursion per trade" interactive={false}>
          <InteractiveChart option={mfeScatter} size="standard" showHint={false} ariaLabel="MFE MAE scatter" />
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
        .stat {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          font-family: var(--font-mono), monospace;
        }
        .hint {
          margin: 6px 0 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .dq-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .dq-list li {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }
      `}</style>
    </ReportChapter>
  );
}
