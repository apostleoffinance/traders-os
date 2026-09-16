"use client";

import type { ReactNode } from "react";
import { Panel } from "@/components/ui";
import { EvidenceTag } from "@/components/analytics/Charts";
import type { AnalyticsInsight, AnalyticsTier } from "@/lib/analytics/types";

/**
 * Chart-first panel — title + optional sample tag + children.
 * Subtitles, questions, insights, and drill hints are accepted but not rendered.
 * Content-sized by default so short charts do not leave dead space under the plot.
 */
export function ChartCard({
  title,
  question: _question,
  subtitle: _subtitle,
  sampleSize,
  evidenceLabel,
  tier: _tier,
  insight: _insight,
  actions,
  hint: _hint,
  interactive: _interactive = false,
  children,
}: {
  title: string;
  question?: string;
  subtitle?: string;
  sampleSize?: number;
  evidenceLabel?: string;
  tier?: AnalyticsTier;
  insight?: AnalyticsInsight | null;
  actions?: ReactNode;
  hint?: string;
  interactive?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="chart-card">
      <Panel
        className="chart-panel"
        title={title}
        right={
          <div className="right">
            {actions}
            {(evidenceLabel || sampleSize != null) && <EvidenceTag label={evidenceLabel} n={sampleSize} />}
          </div>
        }
      >
        {children}
      </Panel>
      <style jsx>{`
        .chart-card {
          display: block;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          overflow-x: hidden;
        }
        .chart-card :global(.chart-panel) {
          width: 100%;
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
      `}</style>
    </div>
  );
}
