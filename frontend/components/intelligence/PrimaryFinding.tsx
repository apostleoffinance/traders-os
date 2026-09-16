"use client";

import type { Finding } from "@/lib/intelligence";
import { confidenceText } from "@/lib/intelligence";
import { EvidenceStrip, findingTypeLabel } from "./EvidenceStrip";
import { InvestigateButton } from "./InvestigateButton";
import { SeverityBadge } from "./SeverityBadge";

export function PrimaryFinding({
  finding,
  early = false,
  tradeCount,
}: {
  finding: Finding;
  early?: boolean;
  tradeCount?: number;
}) {
  const confidence = confidenceText(finding.confidence, finding.sampleSize);

  return (
    <section className="primary" aria-labelledby="primary-intel-title">
      <header className="head">
        <div className="eyebrow-row">
          <p className="eyebrow" id="primary-intel-title">
            Primary intelligence
          </p>
          <SeverityBadge severity={finding.severity} />
        </div>
        <span className="type">{findingTypeLabel(finding.type)}</span>
      </header>

      <h2 className="title">{finding.title}</h2>
      <p className="summary">{finding.summary}</p>

      {finding.metric ? (
        <p className={`hero-metric ${finding.metric.tone ?? "neutral"}`}>
          <span className="hero-value">{finding.metric.value}</span>
          <span className="hero-label">{finding.metric.label}</span>
        </p>
      ) : null}

      <EvidenceStrip evidence={finding.evidence} comparison={finding.comparison} />

      <div className="why">
        <p className="why-label">Why it matters</p>
        <p>{finding.whyItMatters}</p>
      </div>

      <div className="footer">
        <p className="confidence" title={finding.whySurfaced}>
          <span className="conf-label">Confidence</span>
          <span>{confidence}</span>
        </p>
        <InvestigateButton finding={finding} label={finding.action.label || "Explore this edge →"} />
      </div>

      {early && tradeCount != null ? (
        <p className="early-note" role="note">
          {tradeCount} trades — treat this as an early signal.
        </p>
      ) : null}

      <details className="why-details">
        <summary>Why am I seeing this?</summary>
        <p>{finding.whySurfaced}</p>
      </details>

      <style jsx>{`
        .primary {
          border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border));
          border-radius: 12px;
          background: linear-gradient(
            165deg,
            color-mix(in srgb, var(--accent-soft) 55%, var(--surface-elevated)) 0%,
            var(--surface) 48%,
            var(--surface) 100%
          );
          padding: 18px 20px 16px;
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
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .eyebrow-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .eyebrow {
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
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .title {
          margin: 0;
          font-size: clamp(1.15rem, 2.2vw, 1.45rem);
          font-weight: 650;
          line-height: 1.25;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }
        .summary {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: var(--text-secondary);
          max-width: 62ch;
        }
        .hero-metric {
          display: flex;
          align-items: baseline;
          gap: 10px;
          margin: 0;
        }
        .hero-value {
          font-size: 1.75rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          color: var(--text-primary);
        }
        .hero-metric.pos .hero-value {
          color: var(--pos);
        }
        .hero-metric.neg .hero-value {
          color: var(--neg);
        }
        .hero-label {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 600;
        }
        .why {
          padding: 10px 12px;
          border-radius: 8px;
          background: color-mix(in srgb, var(--surface-2) 70%, transparent);
          border: 1px solid var(--border);
        }
        .why-label {
          margin: 0 0 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .why p {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
        }
        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding-top: 4px;
        }
        .confidence {
          margin: 0;
          display: grid;
          gap: 2px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .conf-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .early-note {
          margin: 0;
          font-size: 12px;
          color: var(--warning, var(--accent-text));
        }
        .why-details {
          border-top: 1px solid var(--border);
          padding-top: 8px;
        }
        .why-details summary {
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent-text, var(--accent));
          list-style: none;
        }
        .why-details summary::-webkit-details-marker {
          display: none;
        }
        .why-details summary:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .why-details p {
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
      <div className="line w40" />
      <div className="line w80 tall" />
      <div className="line w60" />
      <div className="row">
        <div className="block" />
        <div className="block" />
        <div className="block" />
      </div>
      <style jsx>{`
        .skel {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          padding: 18px 20px;
          display: grid;
          gap: 12px;
        }
        .line {
          height: 12px;
          border-radius: 4px;
          background: linear-gradient(
            90deg,
            var(--surface-2) 0%,
            color-mix(in srgb, var(--accent-soft) 40%, var(--surface-2)) 50%,
            var(--surface-2) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.4s ease-in-out infinite;
        }
        .tall {
          height: 22px;
        }
        .w40 {
          width: 40%;
        }
        .w60 {
          width: 60%;
        }
        .w80 {
          width: 80%;
        }
        .row {
          display: flex;
          gap: 10px;
        }
        .block {
          width: 88px;
          height: 36px;
          border-radius: 6px;
          background: var(--surface-2);
        }
        @keyframes shimmer {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: -100% 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .line {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
