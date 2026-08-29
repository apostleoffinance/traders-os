"use client";

import Link from "next/link";
import { Stat } from "@/components/ui";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import type { AnalyticsDashboard } from "@/lib/analytics";

export function TradeHabitsSection({
  data,
  onExploreExecution,
}: {
  data: AnalyticsDashboard;
  onExploreExecution?: () => void;
}) {
  const n = data.overview.n_trades;
  const consistency = data.consistency;
  const duration = data.lab?.execution.duration;
  const position = data.lab?.execution.position_size;

  const tradesPerDay =
    consistency.trading_days > 0 ? (n / consistency.trading_days).toFixed(1) : "—";

  const topDuration = duration?.buckets?.filter((b) => b.n > 0).sort((a, b) => b.n - a.n)[0];
  const topSize = position?.buckets?.filter((b) => b.n > 0).sort((a, b) => b.n - a.n)[0];

  if (n === 0) return null;

  return (
    <section className="section">
      <h2 className="section-title">Trade habits</h2>
      <p className="section-lead">How often you trade and how you size positions in this sample.</p>

      <ChartCard title="Activity snapshot" question="How active am I, and how long do I hold trades?">
        <div className="stats">
          <Stat label="Trading days" value={String(consistency.trading_days)} />
          <Stat label="Avg trades / day" value={tradesPerDay} />
          <Stat
            label="Most common hold time"
            value={topDuration ? `${topDuration.bucket} (${topDuration.n} trades)` : "—"}
          />
          <Stat
            label="Most common size bucket"
            value={topSize ? `${topSize.bucket} (${topSize.n} trades)` : "—"}
          />
          {data.frequency[0] && (
            <Stat
              label="Busiest frequency group"
              value={`${data.frequency[0].key} · n=${data.frequency[0].n}`}
            />
          )}
        </div>
        <p className="note">These are observed patterns in your journal — not recommendations.</p>
        {onExploreExecution ? (
          <button type="button" className="link-btn" onClick={onExploreExecution}>
            Explore execution →
          </button>
        ) : (
          <Link href="/analytics?tab=execution" className="link-btn">
            Explore execution →
          </Link>
        )}
      </ChartCard>

      <style jsx>{`
        .section {
          margin-bottom: 8px;
        }
        .section-title {
          margin: 0 0 4px;
          font-size: 15px;
        }
        .section-lead {
          margin: 0 0 14px;
          font-size: 14px;
          color: var(--text-muted);
        }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }
        .note {
          margin: 12px 0;
          font-size: 13px;
          color: var(--text-muted);
        }
        .link-btn {
          border: none;
          background: transparent;
          color: var(--accent);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          text-decoration: none;
        }
      `}</style>
    </section>
  );
}
