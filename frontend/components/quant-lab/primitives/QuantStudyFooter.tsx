"use client";

import type { SamplePolicy } from "@/lib/quant";
import { EVIDENCE_LABELS } from "@/lib/quant";
import {
  getQuantStudy,
  getQuantStudyMeta,
  quantSampleWarning,
  type QuantStudyId,
} from "@/lib/analytics/quant-studies";

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
          <span className="label">Research question</span>
          {def.primaryQuestion}
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
          <span className="label">Statistical caution</span>
          <ul>
            {sampleWarning && <li>{sampleWarning}</li>}
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
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
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        .question {
          margin: 0;
          font-weight: 500;
          color: var(--text-secondary);
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
