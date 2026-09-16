"use client";

import { ChartCard, MetricCard } from "@/components/trader";
import type { IntelligenceLab } from "@/components/intelligence/Phase3Intelligence";

/**
 * L1 Decision Intelligence — process vs outcome without requiring the bar chart first.
 * Methodology comes from the quantitative engine (intel.decision_quality).
 */
export function DecisionQualitySummary({ intel }: { intel: IntelligenceLab }) {
  const dq = intel.decision_quality;
  const total =
    dq.counts.good_win + dq.counts.good_loss + dq.counts.lucky_win + dq.counts.bad_loss;
  const processGood = dq.counts.good_win + dq.counts.good_loss;
  const processPct = total > 0 ? Math.round((processGood / total) * 100) : null;

  let observation: string;
  let direction: "positive" | "negative" | "neutral" | "mixed" = "neutral";
  if (total === 0) {
    observation = "Not enough classified trades yet to judge process quality.";
  } else if (processPct != null && processPct >= 60) {
    observation = `${processPct}% of classified trades followed a good process (good win or good loss).`;
    direction = "positive";
  } else if (processPct != null && processPct < 40) {
    observation = `Only ${processPct}% of classified trades followed a good process — lucky wins and bad losses are driving outcomes.`;
    direction = "negative";
  } else {
    observation = `Process quality is mixed (${processPct ?? "—"}% good-process trades). Review lucky wins and bad losses next.`;
    direction = "mixed";
  }

  return (
    <ChartCard
      title="Process vs outcome"
      question="Is my behavior helping my trading?"
      tier="essential"
      sampleSize={dq.sample_size}
      subtitle="Classifies trades by whether the process was sound — not only whether P&L was positive."
      insight={{
        summary: "Decision quality from your journal rules and outcomes.",
        observation,
        takeaway:
          direction === "negative"
            ? "Open the deep-dive chart and filter lucky wins / bad losses to find repeated mistakes."
            : "Keep tagging process notes so this classification stays reliable.",
        sampleSize: dq.sample_size,
        direction,
        methodology: dq.methodology,
      }}
    >
      {total === 0 ? (
        <p className="empty">Close and classify more trades to see process quality.</p>
      ) : (
        <div className="grid">
          <MetricCard label="Good process" value={`${processPct ?? "—"}%`} hint={`${processGood} of ${total} trades`} />
          <MetricCard label={dq.labels.good_win} value={String(dq.counts.good_win)} tone="pos" />
          <MetricCard label={dq.labels.good_loss} value={String(dq.counts.good_loss)} />
          <MetricCard label={dq.labels.lucky_win} value={String(dq.counts.lucky_win)} tone="neg" />
          <MetricCard label={dq.labels.bad_loss} value={String(dq.counts.bad_loss)} tone="neg" />
        </div>
      )}
      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }
        .empty {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
        }
      `}</style>
    </ChartCard>
  );
}
