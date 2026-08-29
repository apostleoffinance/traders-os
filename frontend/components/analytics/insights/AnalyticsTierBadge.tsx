"use client";

import type { AnalyticsTier } from "@/lib/analytics/types";

const LABELS: Record<AnalyticsTier, string> = {
  essential: "Essential",
  deep_dive: "Deep dive",
  quant: "Quant",
};

export function AnalyticsTierBadge({ tier }: { tier: AnalyticsTier }) {
  return (
    <span className={`badge ${tier}`}>{LABELS[tier]}
      <style jsx>{`
        .badge {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 2px 7px;
          border-radius: 4px;
        }
        .essential {
          color: var(--success);
          background: color-mix(in srgb, var(--success) 12%, transparent);
        }
        .deep_dive {
          color: var(--accent);
          background: color-mix(in srgb, var(--accent) 12%, transparent);
        }
        .quant {
          color: var(--text-secondary);
          background: color-mix(in srgb, var(--text-muted) 15%, transparent);
        }
      `}</style>
    </span>
  );
}
