"use client";

import { sampleLabel } from "@/lib/analytics/sample";

export function SampleSizeBadge({ n, label = "Sample" }: { n: number; label?: string }) {
  return (
    <span className="badge" title={`Based on ${sampleLabel(n)}`}>
      {label}: {sampleLabel(n)}
      <style jsx>{`
        .badge {
          font-size: 11px;
          color: var(--text-muted);
          font-family: var(--font-mono), monospace;
        }
      `}</style>
    </span>
  );
}
