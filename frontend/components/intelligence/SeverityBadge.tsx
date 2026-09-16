"use client";

import type { FindingSeverity } from "@/lib/intelligence";

const LABEL: Record<FindingSeverity, string> = {
  INFO: "Info",
  WATCH: "Watch",
  IMPORTANT: "Important",
  CRITICAL: "Critical",
};

/** Severity as text + style — never color alone. */
export function SeverityBadge({
  severity,
  compact = false,
}: {
  severity: FindingSeverity | string;
  compact?: boolean;
}) {
  const key = (severity.toUpperCase() as FindingSeverity) in LABEL
    ? (severity.toUpperCase() as FindingSeverity)
    : "INFO";
  const text = LABEL[key];

  return (
    <span
      className={`sev sev-${key.toLowerCase()} ${compact ? "compact" : ""}`}
      aria-label={`Severity: ${text}`}
    >
      <span className="dot" aria-hidden />
      {text}
      <style jsx>{`
        .sev {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 3px 7px;
          border-radius: 4px;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          background: var(--surface-2);
          white-space: nowrap;
        }
        .compact {
          font-size: 9px;
          padding: 2px 6px;
        }
        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          flex-shrink: 0;
        }
        .sev-watch {
          color: var(--warning, var(--accent));
          border-color: color-mix(in srgb, var(--warning, var(--accent)) 45%, var(--border));
          background: color-mix(in srgb, var(--warning, var(--accent)) 10%, var(--surface));
        }
        .sev-important {
          color: var(--warning, #e8a838);
          border-color: color-mix(in srgb, var(--warning, #e8a838) 50%, var(--border));
          background: color-mix(in srgb, var(--warning, #e8a838) 12%, var(--surface));
        }
        .sev-critical {
          color: var(--neg);
          border-color: color-mix(in srgb, var(--neg) 50%, var(--border));
          background: color-mix(in srgb, var(--neg) 12%, var(--surface));
        }
        .sev-info {
          color: var(--accent-text, var(--accent));
          border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
        }
      `}</style>
    </span>
  );
}
