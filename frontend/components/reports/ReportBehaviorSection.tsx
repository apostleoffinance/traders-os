"use client";

import { DisciplineScatterPanel, PsychologyBubbleMatrix } from "@/components/intelligence/IntelligenceViz";
import type { IntelligenceLab } from "@/components/intelligence/Phase3Intelligence";
import { ReportChapter } from "@/components/reports/story/ReportChapter";

export function ReportBehaviorSection({ behavior }: { behavior: Record<string, unknown> }) {
  const intel = behavior as unknown as IntelligenceLab;
  if (!intel?.metadata) {
    return (
      <ReportChapter
        id="behavior"
        title="4. Behaviour"
        question="Did my behavior help or hurt performance?"
        takeaway="Insufficient behavioral tags for this period."
      >
        <p className="muted">Tag psychology and checklist fields on trades to unlock this chapter.</p>
        <style jsx>{`
          .muted {
            color: var(--muted);
            font-size: 13px;
          }
        `}</style>
      </ReportChapter>
    );
  }

  const dq = intel.decision_quality;
  const total =
    (dq?.counts?.good_win ?? 0) + (dq?.counts?.good_loss ?? 0) + (dq?.counts?.lucky_win ?? 0) + (dq?.counts?.bad_loss ?? 0);
  const good = (dq?.counts?.good_win ?? 0) + (dq?.counts?.good_loss ?? 0);
  const pct = total > 0 ? Math.round((good / total) * 100) : null;
  const takeaway =
    pct != null
      ? `${pct}% of classified trades followed a good process (good win or good loss).`
      : "Review emotion and discipline charts below for patterns in this sample.";

  return (
    <ReportChapter id="behavior" title="4. Behaviour" question="Did my behavior help or hurt performance?" takeaway={takeaway}>
      {dq && total > 0 ? (
        <div className="dq">
          <span>Good win {dq.counts.good_win}</span>
          <span>Good loss {dq.counts.good_loss}</span>
          <span>Lucky win {dq.counts.lucky_win}</span>
          <span>Bad loss {dq.counts.bad_loss}</span>
        </div>
      ) : null}
      <PsychologyBubbleMatrix intel={intel} />
      <DisciplineScatterPanel intel={intel} />
      <style jsx>{`
        .dq {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 16px;
          margin-bottom: 14px;
          font-size: 13px;
          color: var(--text-muted);
        }
      `}</style>
    </ReportChapter>
  );
}
