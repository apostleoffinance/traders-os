"use client";

import type { InsightStrength } from "@/lib/analytics/types";
import { confidenceLabel } from "@/lib/analytics/confidence";

const TONE: Record<InsightStrength, string> = {
  insufficient: "insufficient",
  early: "early",
  moderate: "moderate",
  strong: "strong",
};

export function ConfidenceBadge({ strength }: { strength: InsightStrength }) {
  return (
    <span className={`badge ${TONE[strength]}`} title={confidenceLabel(strength)}>
      {confidenceLabel(strength)}
      <style jsx>{`
        .badge {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid var(--border);
        }
        .insufficient {
          color: var(--text-muted);
          background: var(--surface-2, var(--surface));
        }
        .early {
          color: var(--warning, var(--accent));
          border-color: color-mix(in srgb, var(--warning, var(--accent)) 40%, var(--border));
        }
        .moderate {
          color: var(--accent);
          border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
        }
        .strong {
          color: var(--success);
          border-color: color-mix(in srgb, var(--success) 40%, var(--border));
        }
      `}</style>
    </span>
  );
}
