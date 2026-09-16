"use client";

import { ChartCard, MetricCard } from "@/components/trader";
import type { IntelligenceLab } from "@/components/intelligence/Phase3Intelligence";

/** Process vs outcome counts — metrics first. */
export function DecisionQualitySummary({ intel }: { intel: IntelligenceLab }) {
  const dq = intel.decision_quality;
  const total =
    dq.counts.good_win + dq.counts.good_loss + dq.counts.lucky_win + dq.counts.bad_loss;
  const processGood = dq.counts.good_win + dq.counts.good_loss;
  const processPct = total > 0 ? Math.round((processGood / total) * 100) : null;

  return (
    <ChartCard title="Process vs outcome" tier="essential" sampleSize={dq.sample_size}>
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
