"use client";

import { ANALYTICS_MIN_SAMPLE } from "@/lib/analytics/sample";

export function InsufficientSample({
  n,
  context = "this analysis",
  threshold = ANALYTICS_MIN_SAMPLE,
}: {
  n: number;
  context?: string;
  threshold?: number;
}) {
  if (n >= threshold) return null;

  return (
    <div className="insufficient" role="status">
      <strong>Building your sample</strong>
      <p>
        We need more closed trades before {context} becomes reliable. Suggested minimum: {threshold} trades.
      </p>
      <p className="count">
        Current sample: {n} trade{n === 1 ? "" : "s"}
      </p>
      <style jsx>{`
        .insufficient {
          border: 1px dashed var(--border);
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 12px;
          background: color-mix(in srgb, var(--surface-2, var(--surface)) 60%, transparent);
        }
        strong {
          display: block;
          font-size: 13px;
          margin-bottom: 6px;
        }
        p {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .count {
          margin-top: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}
