"use client";

import type { ReactNode } from "react";
import type { AnalyticsInsight } from "@/lib/analytics/types";
import { ConfidenceBadge } from "@/components/analytics/insights/ConfidenceBadge";
import { SampleSizeBadge } from "@/components/analytics/insights/SampleSizeBadge";

/**
 * First-class insight card — recurring TraderOS pattern:
 * WHAT? → SO WHAT? → NOW WHAT?
 */
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
    <aside className={`insight ${compact ? "compact" : ""}`} aria-label="Insight: what, so what, now what">
      <div className="meta">
        {insight.strength && <ConfidenceBadge strength={insight.strength} />}
        {insight.sampleSize != null && <SampleSizeBadge n={insight.sampleSize} />}
      </div>

      {!compact && insight.summary && (
        <div className="block">
          <span className="label">
            What? <span className="soft">What you&apos;re seeing</span>
          </span>
          <p>{insight.summary}</p>
        </div>
      )}

      <div className="block">
        <span className="label">
          So what? <span className="soft">Key insight</span>
        </span>
        <p className={`obs ${insight.direction ?? "neutral"}`}>{insight.observation}</p>
      </div>

      {insight.takeaway && (
        <div className="block">
          <span className="label">
            Now what? <span className="soft">Next action</span>
          </span>
          <p>{insight.takeaway}</p>
        </div>
      )}

      {insight.warning && (
        <p className="warning" role="note">
          {insight.warning}
        </p>
      )}

      {insight.methodology && (
        <div className="block methodology">
          <span className="label">Methodology</span>
          <p>{insight.methodology}</p>
        </div>
      )}

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
          margin-bottom: 10px;
        }
        .block {
          margin-bottom: 10px;
        }
        .block:last-child {
          margin-bottom: 0;
        }
        .label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--accent);
          margin-bottom: 4px;
        }
        .soft {
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          text-transform: uppercase;
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
        .warning {
          margin: 8px 0 0;
          font-size: 12px;
          color: var(--warning, var(--accent));
          border-left: 3px solid var(--warning, var(--accent));
          padding-left: 10px;
        }
        .methodology p {
          font-size: 12px;
          color: var(--text-muted);
        }
      `}</style>
    </aside>
  );
}

/** @deprecated Prefer InsightCard — kept for ChartCard / legacy call sites. */
export const InsightLayer = InsightCard;
