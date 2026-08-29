"use client";

import type { ReactNode } from "react";
import { Panel } from "@/components/ui";
import { EvidenceTag } from "@/components/analytics/Charts";
import { InsightLayer } from "@/components/analytics/insights/InsightLayer";
import { AnalyticsTierBadge } from "@/components/analytics/insights/AnalyticsTierBadge";
import type { AnalyticsInsight, AnalyticsTier } from "@/lib/analytics/types";
import { CHART_INTERACTIVE_HINT } from "@/lib/chart-constants";

export function ChartCard({
  title,
  question,
  subtitle,
  sampleSize,
  evidenceLabel,
  tier,
  insight,
  actions,
  hint,
  interactive = false,
  children,
}: {
  title: string;
  /** One-line explanation of what question this chart answers */
  question?: string;
  subtitle?: string;
  sampleSize?: number;
  evidenceLabel?: string;
  tier?: AnalyticsTier;
  insight?: AnalyticsInsight | null;
  actions?: ReactNode;
  hint?: string;
  /** Shows standard drill-down hint when no custom hint is provided */
  interactive?: boolean;
  children: ReactNode;
}) {
  const drillHint = hint ?? (interactive ? CHART_INTERACTIVE_HINT : undefined);

  return (
    <div className="chart-card">
      <Panel
        title={title}
        right={
          <div className="right">
            {tier && <AnalyticsTierBadge tier={tier} />}
            {actions}
            {(evidenceLabel || sampleSize != null) && <EvidenceTag label={evidenceLabel} n={sampleSize} />}
          </div>
        }
      >
        {question && <p className="question">{question}</p>}
        {subtitle && <p className="subtitle muted">{subtitle}</p>}
        {drillHint && <p className="hint muted">{drillHint}</p>}
        {children}
        {insight && <InsightLayer insight={insight} compact />}
      </Panel>
      <style jsx>{`
        .chart-card {
          margin-bottom: 24px;
        }
        .chart-card :global(.panel) {
          margin-bottom: 0;
        }
        .chart-card :global(.kpi-grid) {
          margin-bottom: 4px;
        }
        .right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .question {
          font-size: 13px;
          font-weight: 400;
          color: var(--text-muted);
          margin: 0 0 6px;
          line-height: 1.4;
        }
        .subtitle,
        .hint {
          font-size: 13px;
          margin: 0 0 12px;
        }
        .hint {
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
