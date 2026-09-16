"use client";

import type { FindingComparison, FindingEvidenceItem, FindingType } from "@/lib/intelligence";

/** Compact DOM evidence — no giant charts. */
export function EvidenceStrip({
  evidence,
  comparison,
  compact = false,
}: {
  evidence: FindingEvidenceItem[];
  comparison?: FindingComparison | null;
  compact?: boolean;
}) {
  const bars = comparisonBars(comparison);

  return (
    <div className={`strip ${compact ? "compact" : ""}`} aria-label="Evidence">
      {bars ? (
        <div className="bars" role="img" aria-label={bars.aria}>
          <div className="bar-row">
            <span className="bar-label">{bars.subject.label}</span>
            <div className="track">
              <div
                className={`fill ${bars.subject.tone}`}
                style={{ width: `${bars.subject.width}%` }}
              />
            </div>
            <span className={`bar-value ${bars.subject.tone}`}>{bars.subject.value}</span>
          </div>
          <div className="bar-row">
            <span className="bar-label">{bars.baseline.label}</span>
            <div className="track">
              <div
                className={`fill ${bars.baseline.tone}`}
                style={{ width: `${bars.baseline.width}%` }}
              />
            </div>
            <span className={`bar-value ${bars.baseline.tone}`}>{bars.baseline.value}</span>
          </div>
        </div>
      ) : null}

      {evidence.length > 0 ? (
        <dl className="metrics">
          {evidence.slice(0, compact ? 3 : 6).map((item) => (
            <div key={`${item.label}-${item.value}`} className="metric">
              <dt>{item.label}</dt>
              <dd className={item.tone ?? "neutral"}>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <style jsx>{`
        .strip {
          display: grid;
          gap: 12px;
        }
        .compact {
          gap: 8px;
        }
        .bars {
          display: grid;
          gap: 8px;
        }
        .bar-row {
          display: grid;
          grid-template-columns: minmax(64px, 100px) 1fr auto;
          gap: 10px;
          align-items: center;
        }
        .bar-label {
          font-size: 12px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .track {
          height: 6px;
          border-radius: 3px;
          background: var(--surface-2);
          overflow: hidden;
        }
        .fill {
          height: 100%;
          border-radius: 3px;
          background: var(--accent);
          min-width: 2px;
          transition: width 0.35s ease;
        }
        .fill.pos {
          background: var(--pos);
        }
        .fill.neg {
          background: var(--neg);
        }
        .fill.neutral {
          background: var(--accent);
        }
        .bar-value {
          font-size: 12px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          color: var(--text-primary);
          min-width: 4.5rem;
          text-align: right;
        }
        .bar-value.pos {
          color: var(--pos);
        }
        .bar-value.neg {
          color: var(--neg);
        }
        .metrics {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 18px;
          margin: 0;
        }
        .metric {
          display: grid;
          gap: 2px;
          min-width: 72px;
        }
        .metric dt {
          margin: 0;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          font-weight: 600;
        }
        .metric dd {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          color: var(--text-primary);
        }
        .metric dd.pos {
          color: var(--pos);
        }
        .metric dd.neg {
          color: var(--neg);
        }
        @media (prefers-reduced-motion: reduce) {
          .fill {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

function comparisonBars(comparison: FindingComparison | null | undefined) {
  if (!comparison) return null;
  const subjectN = parseLooseNumber(comparison.subjectValue);
  const baselineN = parseLooseNumber(comparison.baselineValue);
  if (subjectN == null && baselineN == null) return null;

  const absMax = Math.max(Math.abs(subjectN ?? 0), Math.abs(baselineN ?? 0), 0.01);
  const subjectWidth = Math.max(8, Math.round((Math.abs(subjectN ?? 0) / absMax) * 100));
  const baselineWidth = Math.max(8, Math.round((Math.abs(baselineN ?? 0) / absMax) * 100));

  return {
    aria: `${comparison.subjectLabel} ${comparison.subjectValue} versus ${comparison.baselineLabel} ${comparison.baselineValue}`,
    subject: {
      label: comparison.subjectLabel,
      value: comparison.subjectValue,
      width: subjectWidth,
      tone: toneFromNumber(subjectN),
    },
    baseline: {
      label: comparison.baselineLabel,
      value: comparison.baselineValue,
      width: baselineWidth,
      tone: toneFromNumber(baselineN),
    },
  };
}

function parseLooseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.+-]/g, "");
  if (!cleaned || cleaned === "+" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toneFromNumber(n: number | null): "pos" | "neg" | "neutral" {
  if (n == null) return "neutral";
  if (n > 0) return "pos";
  if (n < 0) return "neg";
  return "neutral";
}

export function findingTypeLabel(type: FindingType | string): string {
  return String(type).replace(/_/g, " ");
}
