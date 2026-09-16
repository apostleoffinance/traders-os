"use client";

import type { Finding } from "@/lib/intelligence";
import { confidenceText } from "@/lib/intelligence";
import { EvidenceStrip, findingTypeLabel } from "./EvidenceStrip";
import { InvestigateButton } from "./InvestigateButton";
import { SeverityBadge } from "./SeverityBadge";

/**
 * Primary visual finding — evidence first, short explanation, progressive disclosure.
 * Consumes existing Finding model; no engine changes.
 */
export function PrimaryFinding({ finding }: { finding: Finding }) {
  const evidenceState = confidenceText(finding.confidence, finding.sampleSize);
  const sampleLine =
    finding.sampleSize > 0
      ? `${finding.sampleSize} trade${finding.sampleSize === 1 ? "" : "s"}`
      : null;

  return (
    <section className="primary" aria-labelledby="noticed-title">
      <header className="head">
        <div className="left">
          <p className="section" id="noticed-title">
            TraderOS noticed
          </p>
          <span className="type">{findingTypeLabel(finding.type)}</span>
        </div>
        <SeverityBadge severity={finding.severity} />
      </header>

      <h2 className="title">{finding.title}</h2>

      {finding.metric ? (
        <p className={`hero ${finding.metric.tone ?? "neutral"}`}>
          <span className="hero-value">{finding.metric.value}</span>
          <span className="hero-label">{finding.metric.label}</span>
        </p>
      ) : null}

      <div className="viz">
        <EvidenceStrip evidence={finding.evidence} comparison={finding.comparison} prominent />
      </div>

      {(sampleLine || finding.metric) && (
        <p className="meta">
          {finding.evidence[0] ? (
            <span>
              {finding.evidence[0].label}: {finding.evidence[0].value}
            </span>
          ) : null}
          {sampleLine ? <span>{sampleLine}</span> : null}
          <span className="state">{evidenceState}</span>
        </p>
      )}

      <p className="means">{finding.whyItMatters}</p>

      <div className="actions">
        <InvestigateButton finding={finding} label={finding.action.label || "Explore →"} />
      </div>

      <details className="why">
        <summary>Why am I seeing this?</summary>
        <p>{finding.whySurfaced}</p>
      </details>

      <style jsx>{`
        .primary {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          padding: 18px 18px 14px;
          display: grid;
          gap: 12px;
        }
        .primary :global(.cta) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 14px;
          border-radius: 8px;
          background: var(--accent);
          color: var(--accent-contrast);
          font-size: 13px;
          font-weight: 650;
          text-decoration: none;
          border: 1px solid transparent;
          cursor: pointer;
          font-family: inherit;
        }
        .primary :global(.cta:hover) {
          filter: brightness(1.06);
        }
        .primary :global(.cta:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .primary :global(.cta.disabled) {
          opacity: 0.55;
          cursor: default;
        }
        .head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .left {
          display: grid;
          gap: 4px;
        }
        .section {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent-text, var(--accent));
        }
        .type {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .title {
          margin: 0;
          font-size: clamp(1.2rem, 2.4vw, 1.5rem);
          font-weight: 650;
          line-height: 1.25;
          color: var(--text-primary);
          letter-spacing: -0.015em;
          max-width: 36ch;
        }
        .hero {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin: 0;
        }
        .hero-value {
          font-size: clamp(1.75rem, 3vw, 2.15rem);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          color: var(--text-primary);
          line-height: 1;
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
        .viz {
          padding: 12px 0 4px;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .meta {
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .state {
          color: var(--text-secondary);
        }
        .means {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
          max-width: 58ch;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .why {
          border-top: 1px solid var(--border);
          padding-top: 8px;
        }
        .why summary {
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-text, var(--accent));
          list-style: none;
        }
        .why summary::-webkit-details-marker {
          display: none;
        }
        .why summary:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .why p {
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.45;
          color: var(--text-muted);
        }
      `}</style>
    </section>
  );
}

export function PrimaryFindingSkeleton() {
  return (
    <div className="skel" aria-hidden>
      <div className="line w30" />
      <div className="line w70 tall" />
      <div className="line w40 hero" />
      <div className="bars" />
      <style jsx>{`
        .skel {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          padding: 18px;
          display: grid;
          gap: 12px;
        }
        .line {
          height: 12px;
          border-radius: 4px;
          background: var(--surface-2);
        }
        .tall {
          height: 22px;
        }
        .hero {
          height: 28px;
          width: 35%;
        }
        .w30 {
          width: 30%;
        }
        .w40 {
          width: 40%;
        }
        .w70 {
          width: 70%;
        }
        .bars {
          height: 72px;
          border-radius: 8px;
          background: var(--surface-2);
        }
      `}</style>
    </div>
  );
}
