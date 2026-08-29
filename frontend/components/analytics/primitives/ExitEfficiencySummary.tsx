"use client";

import { num } from "@/lib/format";

type Band = "excellent" | "good" | "average" | "poor";

function bandFromCapture(pct: number | null): Band {
  if (pct === null) return "average";
  if (pct >= 70) return "excellent";
  if (pct >= 50) return "good";
  if (pct >= 30) return "average";
  return "poor";
}

const LABELS: Record<Band, string> = {
  excellent: "Excellent",
  good: "Good",
  average: "Average",
  poor: "Poor",
};

export function ExitEfficiencySummary({ medianCapturePct }: { medianCapturePct: number | null }) {
  const band = bandFromCapture(medianCapturePct);
  const pct = medianCapturePct !== null ? `${num(medianCapturePct, 0)}%` : "—";

  return (
    <div className={`summary ${band}`} role="status">
      <span className="label">Exit quality (median capture)</span>
      <strong className="band">{LABELS[band]}</strong>
      <span className="pct">{pct} of favorable movement captured</span>
      <style jsx>{`
        .summary {
          display: grid;
          gap: 2px;
          padding: 12px 14px;
          border-radius: 10px;
          margin-bottom: 12px;
          border: 1px solid var(--border);
        }
        .excellent {
          border-left: 3px solid var(--success);
        }
        .good {
          border-left: 3px solid color-mix(in srgb, var(--success) 60%, var(--accent));
        }
        .average {
          border-left: 3px solid var(--warning, var(--accent));
        }
        .poor {
          border-left: 3px solid var(--danger);
        }
        .label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
        }
        .band {
          font-size: 18px;
          line-height: 1.2;
        }
        .pct {
          font-size: 13px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
