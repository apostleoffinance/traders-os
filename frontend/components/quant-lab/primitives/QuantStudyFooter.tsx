"use client";

import type { SamplePolicy } from "@/lib/quant";
import type { QuantStudyId } from "@/lib/analytics/quant-studies";

/**
 * Charts-first: no What/So/Methodology essays under studies.
 * Optional one-line sample size only when provided.
 */
export function QuantStudyFooter({
  sample,
}: {
  studyId: QuantStudyId;
  sample?: SamplePolicy;
  extraAssumptions?: string[];
  extraWarnings?: string[];
}) {
  if (!sample || sample.sample_size == null) return null;
  return (
    <p className="n">
      n={sample.sample_size}
      <style jsx>{`
        .n {
          margin: 8px 0 0;
          font-size: 11px;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </p>
  );
}
