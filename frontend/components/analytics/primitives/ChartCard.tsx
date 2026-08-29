"use client";

import type { ReactNode } from "react";
import { Panel } from "@/components/ui";
import { EvidenceTag } from "@/components/analytics/Charts";
import { CHART_INTERACTIVE_HINT } from "@/lib/chart-constants";

export function ChartCard({
  title,
  subtitle,
  sampleSize,
  evidenceLabel,
  actions,
  hint,
  interactive = false,
  children,
}: {
  title: string;
  subtitle?: string;
  sampleSize?: number;
  evidenceLabel?: string;
  actions?: ReactNode;
  hint?: string;
  /** Shows standard drill-down hint when no custom hint is provided */
  interactive?: boolean;
  children: ReactNode;
}) {
  const drillHint = hint ?? (interactive ? CHART_INTERACTIVE_HINT : undefined);

  return (
    <Panel
      title={title}
      right={
        <div className="right">
          {actions}
          {(evidenceLabel || sampleSize != null) && <EvidenceTag label={evidenceLabel} n={sampleSize} />}
        </div>
      }
    >
      {subtitle && <p className="subtitle muted">{subtitle}</p>}
      {drillHint && <p className="hint muted">{drillHint}</p>}
      {children}
      <style jsx>{`
        .right {
          display: flex;
          align-items: center;
          gap: 8px;
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
    </Panel>
  );
}
