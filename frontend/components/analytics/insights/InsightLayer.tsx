"use client";

import type { ReactNode } from "react";
import type { AnalyticsInsight } from "@/lib/analytics/types";
import { ConfidenceBadge } from "@/components/analytics/insights/ConfidenceBadge";
import { SampleSizeBadge } from "@/components/analytics/insights/SampleSizeBadge";

export function InsightLayer({
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
    <aside className={`insight ${compact ? "compact" : ""}`} aria-label="Chart insight">
      <div className="meta">
        {insight.strength && <ConfidenceBadge strength={insight.strength} />}
        {insight.sampleSize != null && <SampleSizeBadge n={insight.sampleSize} />}
      </div>

      {!compact && insight.summary && (
        <div className="block">
          <span className="label">What you&apos;re seeing</span>
          <p>{insight.summary}</p>
        </div>
      )}

      <div className="block">
        <span className="label">Key insight</span>
        <p className={`obs ${insight.direction ?? "neutral"}`}>{insight.observation}</p>
      </div>

      {insight.takeaway && (
        <div className="block">
          <span className="label">Actionable takeaway</span>
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
          color: var(--text-muted);
          margin-bottom: 4px;
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
