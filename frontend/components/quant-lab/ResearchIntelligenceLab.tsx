"use client";

import { useRouter } from "next/navigation";
import { Panel, Stat } from "@/components/ui";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { IntelligenceRunner } from "@/components/IntelligenceRunner";
import { useLiveChart } from "@/components/analytics/Charts";
import type { QuantLabPayload } from "@/lib/quant";
import { getQuantStudy } from "@/lib/analytics/quant-studies";
import { QuantStudyFooter } from "@/components/quant-lab/primitives/QuantStudyFooter";
import { colorForPnl } from "@/lib/chart-colors";
import { signed, num } from "@/lib/format";

const SEVERITY_CLASS: Record<string, string> = {
  warning: "warn",
  opportunity: "good",
  observation: "info",
  info: "info",
};

export function ResearchIntelligenceLab({
  accountId,
  data,
}: {
  accountId: string;
  data: QuantLabPayload;
}) {
  const router = useRouter();
  const { C } = useLiveChart();
  const research = data.research;
  const edgeConfidence = data.edge_confidence;
  const walkForward = data.walk_forward;

  const componentEntries = Object.entries(edgeConfidence.components);
  const edgeConfidenceChart = {
    grid: { left: 120, right: 48, top: 16, bottom: 24 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", max: 100, splitLine: { lineStyle: { color: C.line } } },
    yAxis: {
      type: "category",
      data: componentEntries.map(([key]) => key.replace(/_/g, " ")),
      inverse: true,
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        data: componentEntries.map(([, c]) => ({
          value: c.score,
          itemStyle: { color: c.score >= 60 ? C.pos : c.score >= 40 ? C.amber : C.neg },
        })),
        label: { show: true, position: "right", formatter: "{c}" },
      },
    ],
  };

  const wfChart = {
    grid: { left: 48, right: 16, top: 24, bottom: 40 },
    tooltip: { trigger: "axis" },
    legend: { data: ["In-sample", "Out-of-sample"], bottom: 0 },
    xAxis: { type: "category", data: ["Expectancy R", "Win rate %", "Max DD R"] },
    yAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        name: "In-sample",
        type: "bar",
        data: [
          Number(walkForward.in_sample.expectancy_r ?? 0),
          Number(walkForward.in_sample.win_rate ?? 0),
          Number(walkForward.in_sample.max_drawdown_r ?? 0),
        ].map((v) => ({ value: v, itemStyle: { color: colorForPnl(C, v) } })),
      },
      {
        name: "Out-of-sample",
        type: "bar",
        data: [
          Number(walkForward.out_of_sample.expectancy_r ?? 0),
          Number(walkForward.out_of_sample.win_rate ?? 0),
          Number(walkForward.out_of_sample.max_drawdown_r ?? 0),
        ].map((v) => ({ value: v, itemStyle: { color: colorForPnl(C, v) } })),
      },
    ],
  };

  function goToTab(tab: string) {
    router.replace(`/quant-lab?tab=${tab}`);
  }

  return (
    <div className="stack">
      <ChartCard
        title={getQuantStudy("edge_confidence")?.title ?? "Edge confidence"}
        question={getQuantStudy("edge_confidence")?.primaryQuestion}
        tier="quant"
        interactive
      >
        <div className="score-row">
          <div className="score">
            <span className="value">{edgeConfidence.score}</span>
            <span className="label">{edgeConfidence.label}</span>
          </div>
          <p className="muted">{edgeConfidence.disclaimer}</p>
        </div>
        <InteractiveChart option={edgeConfidenceChart} height={Math.max(180, componentEntries.length * 36 + 48)} showHint={false} />
        <QuantStudyFooter studyId="edge_confidence" />
      </ChartCard>

      <Panel title="Research opportunities">
        {research.opportunities.length === 0 ? (
          <p className="muted">No research prompts for the current filter — expand your sample or adjust filters.</p>
        ) : (
          <ul className="opps">
            {research.opportunities.map((o) => (
              <li key={o.id} className={SEVERITY_CLASS[o.severity] ?? "info"}>
                <div className="head">
                  <span className="type">{o.type.replace(/_/g, " ")}</span>
                  <span className="n">n={o.sample_size}</span>
                </div>
                <h4>{o.title}</h4>
                <p>{o.prompt}</p>
                <button type="button" className="cta" onClick={() => goToTab(o.cta.tab)}>
                  {o.cta.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="muted">{research.disclaimer}</p>
      </Panel>

      <ChartCard
        title={getQuantStudy("walk_forward")?.title ?? walkForward.label}
        question={getQuantStudy("walk_forward")?.primaryQuestion}
        tier="quant"
        subtitle={`Method: ${walkForward.method === "trade_sequence_split" ? `first ${Math.round((walkForward.split_ratio ?? 0.7) * 100)}% vs remainder` : "custom date ranges"}`}
        interactive
      >
        <InteractiveChart option={wfChart} height={260} showHint={false} />
        <div className="wf-grid">
          <div className="wf-col">
            <h4>In-sample</h4>
            <Stat label="Trades" value={String(walkForward.in_sample.n)} />
            <Stat label="Expectancy R" value={walkForward.in_sample.expectancy_r ? `${signed(walkForward.in_sample.expectancy_r)}R` : "—"} />
          </div>
          <div className="wf-col">
            <h4>Out-of-sample</h4>
            <Stat label="Trades" value={String(walkForward.out_of_sample.n)} />
            <Stat label="Expectancy R" value={walkForward.out_of_sample.expectancy_r ? `${signed(walkForward.out_of_sample.expectancy_r)}R` : "—"} />
          </div>
        </div>
        <p className="muted">{walkForward.disclaimer}</p>
        <QuantStudyFooter studyId="walk_forward" sample={walkForward.sample} />
      </ChartCard>

      <IntelligenceRunner
        path={`/api/ai/accounts/${accountId}/quant-research`}
        label="Explain Quant Lab research"
        hint="AI interprets pre-computed Quant Lab metrics only — no trade signals."
      />

      <style jsx>{`
        .stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 16px;
        }
        .score-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          margin-bottom: 16px;
        }
        .score .value {
          font-size: 42px;
          font-weight: 700;
          line-height: 1;
        }
        .score .label {
          display: block;
          font-size: 13px;
          color: var(--muted);
          margin-top: 4px;
        }
        .opps {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .opps li {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
        }
        .opps li.warn {
          border-color: var(--warn-border, #c9a227);
        }
        .head {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--muted);
        }
        h4 {
          margin: 6px 0 4px;
          font-size: 14px;
        }
        .cta {
          margin-top: 8px;
          padding: 6px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface);
          cursor: pointer;
          font-size: 12px;
        }
        .wf-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 12px;
        }
        .wf-col h4 {
          margin: 0 0 8px;
          font-size: 13px;
        }
        .muted {
          font-size: 13px;
          color: var(--muted);
        }
        .method {
          margin-bottom: 12px;
        }
        @media (max-width: 700px) {
          .wf-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
