"use client";

import type { AnalyticsDashboard } from "@/lib/analytics";
import type { Finding } from "@/lib/intelligence";
import { confidenceText, friendlyConfidenceLabel, toSignalViewModel } from "@/lib/intelligence";
import { EvidenceStrip, findingTypeLabel } from "../EvidenceStrip";
import { InvestigateButton } from "../InvestigateButton";
import { ContextualEvidenceViz } from "./ContextualEvidenceViz";

/**
 * Evidence panel for the selected signal — metric, DOM strip, contextual rank bars.
 */
export function SelectedEvidence({
  finding,
  dashboard,
  onClear,
}: {
  finding: Finding | null;
  dashboard?: AnalyticsDashboard | null;
  onClear?: () => void;
}) {
  if (!finding) {
    return (
      <section className="evidence empty" aria-labelledby="evidence-title">
        <header className="head">
          <h2 id="evidence-title">Evidence</h2>
          <p className="sub">Select a signal to see why TraderOS surfaced it.</p>
        </header>
        <style jsx>{`
          .evidence {
            display: grid;
            gap: 10px;
            padding: 14px;
            border: 1px dashed var(--border);
            border-radius: 12px;
            background: color-mix(in srgb, var(--surface) 80%, transparent);
          }
          h2 {
            margin: 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--text-primary);
          }
          .sub {
            margin: 4px 0 0;
            font-size: 12px;
            color: var(--text-muted);
          }
        `}</style>
      </section>
    );
  }

  const vm = toSignalViewModel(finding);
  const state = friendlyConfidenceLabel(finding.confidence);

  return (
    <section className="evidence" aria-labelledby="evidence-title">
      <header className="head">
        <div>
          <h2 id="evidence-title">Evidence</h2>
          <p className="type">
            {vm.statusLabel} · {findingTypeLabel(finding.type)}
          </p>
        </div>
        {onClear ? (
          <button type="button" className="clear" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </header>

      <h3 className="title">{finding.title}</h3>

      {finding.metric ? (
        <p className={`hero ${finding.metric.tone ?? "neutral"}`}>
          <span className="hero-value">{finding.metric.value}</span>
          <span className="hero-label">{finding.metric.label}</span>
        </p>
      ) : null}

      <EvidenceStrip evidence={finding.evidence} comparison={finding.comparison} prominent />

      <ContextualEvidenceViz finding={finding} dashboard={dashboard ?? null} />

      <p className="meta">
        <span>{state}</span>
        {finding.sampleSize > 0 ? (
          <span>
            {finding.sampleSize} trade{finding.sampleSize === 1 ? "" : "s"} analyzed
          </span>
        ) : null}
        <span className="sr-only">{confidenceText(finding.confidence, finding.sampleSize)}</span>
      </p>

      <p className="why">{finding.whySurfaced}</p>

      <div className="actions">
        <InvestigateButton finding={finding} label={finding.action.label || "Inspect →"} />
      </div>

      <style jsx>{`
        .evidence {
          display: grid;
          gap: 12px;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
        }
        .head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        h2 {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent-text, var(--accent));
        }
        .type {
          margin: 4px 0 0;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .clear {
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-secondary);
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .clear:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 650;
          color: var(--text-primary);
        }
        .hero {
          margin: 0;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .hero-value {
          font-size: 1.6rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
        }
        .hero.pos .hero-value {
          color: var(--pos);
        }
        .hero.neg .hero-value {
          color: var(--neg);
        }
        .hero-label {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .meta {
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          border: 0;
        }
        .why {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
          max-width: 62ch;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .evidence :global(.cta) {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          border-radius: 8px;
          background: var(--accent);
          color: var(--accent-contrast);
          font-size: 13px;
          font-weight: 650;
          border: none;
          cursor: pointer;
          font-family: inherit;
        }
        .evidence :global(.cta:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
      `}</style>
    </section>
  );
}
