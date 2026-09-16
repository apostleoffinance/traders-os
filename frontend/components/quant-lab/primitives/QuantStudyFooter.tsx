"use client";

import type { SamplePolicy } from "@/lib/quant";
import { EVIDENCE_LABELS } from "@/lib/quant";
import {
  getQuantStudy,
  getQuantStudyMeta,
  quantSampleWarning,
  type QuantStudyId,
} from "@/lib/analytics/quant-studies";

/**
 * Quant study interpretation footer — research hierarchy:
 * WHAT? → SO WHAT? → methodology / sample → caution (NOW WHAT = do not treat as a signal).
 */
export function QuantStudyFooter({
  studyId,
  sample,
  extraAssumptions,
  extraWarnings,
}: {
  studyId: QuantStudyId;
  sample?: SamplePolicy;
  extraAssumptions?: string[];
  extraWarnings?: string[];
}) {
  const def = getQuantStudy(studyId);
  const meta = getQuantStudyMeta(studyId);
  const assumptions = [...meta.assumptions, ...(extraAssumptions ?? [])];
  const warnings = [...meta.warnings, ...(extraWarnings ?? [])];
  const sampleWarning = quantSampleWarning(sample, def?.minimumSampleSize);

  if (!def && assumptions.length === 0 && warnings.length === 0) return null;

  return (
    <footer className="quant-footer">
      {def?.primaryQuestion && (
        <p className="question">
          <span className="label">What?</span>
          <span className="soft">What does this mean?</span>
          {def.primaryQuestion}
        </p>
      )}
      {def?.traderValue && (
        <p className="care">
          <span className="label">So what?</span>
          <span className="soft">Why should I care?</span>
          {def.traderValue}
        </p>
      )}
      {def?.methodology && (
        <p className="method">
          <span className="label">Methodology</span>
          {def.methodology}
        </p>
      )}
      {sample && (
        <p className="sample">
          <span className="label">Sample</span>
          {EVIDENCE_LABELS[sample.evidence_level] ?? sample.evidence_level} · {sample.sample_size} trade
          {sample.sample_size === 1 ? "" : "s"}
          {def?.minimumSampleSize != null ? ` · min suggested ${def.minimumSampleSize}` : ""}
          {sample.message ? ` — ${sample.message}` : ""}
        </p>
      )}
      {assumptions.length > 0 && (
        <div className="block">
          <span className="label">Assumptions</span>
          <ul>
            {assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {(warnings.length > 0 || sampleWarning) && (
        <div className="block warn">
          <span className="label">Now what? · Statistical caution</span>
          <ul>
            {sampleWarning && <li>{sampleWarning}</li>}
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
            <li>Do not treat Quant Lab outputs as trade signals — use them to stress-test journal claims.</li>
          </ul>
        </div>
      )}
      <style jsx>{`
        .quant-footer {
          margin-top: 14px;
          padding-top: 12px;
          border-top: 1px dashed var(--border);
          display: grid;
          gap: 10px;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.45;
        }
        .label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--accent);
          margin-bottom: 2px;
        }
        .soft {
          display: block;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        .question,
        .care {
          margin: 0;
          font-weight: 500;
          color: var(--text-secondary, var(--text));
        }
        .method,
        .sample {
          margin: 0;
        }
        .block ul {
          margin: 4px 0 0;
          padding-left: 18px;
        }
        .block li {
          margin-bottom: 3px;
        }
        .warn {
          color: color-mix(in srgb, var(--warning, #d97706) 85%, var(--text-muted));
        }
      `}</style>
    </footer>
  );
}
