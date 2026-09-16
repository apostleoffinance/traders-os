"use client";

import type { ReactNode } from "react";
import type { AnalyticsInsight } from "@/lib/analytics/types";
import { ConfidenceBadge } from "@/components/analytics/insights/ConfidenceBadge";
import { SampleSizeBadge } from "@/components/analytics/insights/SampleSizeBadge";

/** Compact observation + optional takeaway — no What/So/Now labels. */
export function InsightCard({
  insight,
  compact = false,
  drilldown,
}: {
  insight: AnalyticsInsight | null | undefined;
  compact?: boolean;
  drilldown?: ReactNode;
}) {
  if (!insight) return null;

  return (
    <aside className={`insight ${compact ? "compact" : ""}`} aria-label="Insight">
      <div className="meta">
        {insight.strength && <ConfidenceBadge strength={insight.strength} />}
        {insight.sampleSize != null && <SampleSizeBadge n={insight.sampleSize} />}
      </div>

      <p className={`obs ${insight.direction ?? "neutral"}`}>{insight.observation}</p>

      {insight.takeaway ? <p className="takeaway">{insight.takeaway}</p> : null}

      {insight.warning ? (
        <p className="warning" role="note">
          {insight.warning}
        </p>
      ) : null}

      {drilldown}

      <style jsx>{`
        .insight {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: color-mix(in srgb, var(--surface-2, var(--surface)) 50%, var(--surface));
        }
        .compact {
          margin-top: 10px;
          padding: 10px 12px;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        p {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
        }
        .obs.positive {
          color: var(--success);
        }
        .obs.negative {
          color: var(--danger);
        }
        .takeaway {
          margin-top: 8px;
          color: var(--text-muted);
        }
        .warning {
          margin: 8px 0 0;
          font-size: 12px;
          color: var(--warning, var(--accent));
          border-left: 3px solid var(--warning, var(--accent));
          padding-left: 10px;
        }
      `}</style>
    </aside>
  );
}

/** @deprecated Prefer InsightCard — kept for ChartCard / legacy call sites. */
export const InsightLayer = InsightCard;
