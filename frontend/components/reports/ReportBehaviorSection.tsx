"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { DisciplineScatterPanel, PsychologyBubbleMatrix } from "@/components/intelligence/IntelligenceViz";
import type { IntelligenceLab } from "@/components/intelligence/Phase3Intelligence";

export function ReportBehaviorSection({ behavior }: { behavior: Record<string, unknown> }) {
  const intel = behavior as unknown as IntelligenceLab;
  if (!intel?.metadata) {
    return (
      <>
        <h2 className="section-title">Discipline & behavior</h2>
        <p className="muted">Insufficient behavioral data for this period.</p>
      </>
    );
  }

  return (
    <>
      <h2 className="section-title">Discipline & behavior</h2>
      <p className="lede">Did your behavior help or hurt performance?</p>
      <PsychologyBubbleMatrix intel={intel} />
      <DisciplineScatterPanel intel={intel} />
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 8px;
        }
        .lede {
          color: var(--muted);
          margin-bottom: 16px;
        }
        .muted {
          color: var(--muted);
        }
      `}</style>
    </>
  );
}
