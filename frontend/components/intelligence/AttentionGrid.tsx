"use client";

import type { Finding } from "@/lib/intelligence";
import { confidenceText } from "@/lib/intelligence";
import { EvidenceStrip, findingTypeLabel } from "./EvidenceStrip";
import { InvestigateButton } from "./InvestigateButton";
import { SeverityBadge } from "./SeverityBadge";

export function AttentionCard({ finding, early = false }: { finding: Finding; early?: boolean }) {
  const metric = finding.metric;
  const sampleLine =
    finding.sampleSize > 0
      ? `${finding.sampleSize} trade${finding.sampleSize === 1 ? "" : "s"}`
      : null;
  const conf = confidenceText(finding.confidence, finding.sampleSize);

  return (
    <article
      className={`card sev-${finding.severity.toLowerCase()}`}
      aria-label={`${findingTypeLabel(finding.type)}: ${finding.title}. Severity ${finding.severity}.`}
    >
      <header className="head">
        <span className="type">{findingTypeLabel(finding.type)}</span>
        <SeverityBadge severity={finding.severity} compact />
      </header>

      <h3 className="title">{finding.title}</h3>
      <p className="summary">{finding.summary}</p>

      {(metric || sampleLine) && (
        <div className="stats">
          {metric ? (
            <p className={`stat ${metric.tone ?? "neutral"}`}>
              <span className="stat-value">{metric.value}</span>
              <span className="stat-label">{metric.label}</span>
            </p>
          ) : null}
          {sampleLine ? <p className="sample">{sampleLine}</p> : null}
        </div>
      )}

      <EvidenceStrip
        evidence={finding.evidence.slice(0, 3)}
        comparison={finding.comparison}
        compact
      />

      <footer className="foot">
        <span className="conf" title={finding.whySurfaced}>
          {early ? `Early signal · ${sampleLine ?? conf}` : conf}
        </span>
        <InvestigateButton finding={finding} label="Investigate →" />
      </footer>

      <style jsx>{`
        .card {
          display: grid;
          gap: 10px;
          padding: 14px 14px 12px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          border-left: 3px solid var(--border);
          min-width: 0;
        }
        .sev-watch {
          border-left-color: color-mix(in srgb, var(--warning, var(--accent)) 70%, var(--border));
        }
        .sev-important {
          border-left-color: color-mix(in srgb, var(--warning, #e8a838) 80%, var(--border));
        }
        .sev-critical {
          border-left-color: var(--neg);
        }
        .sev-info {
          border-left-color: color-mix(in srgb, var(--accent) 55%, var(--border));
        }
        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .type {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--accent-text, var(--accent));
        }
        .title {
          margin: 0;
          font-size: 14px;
          font-weight: 650;
          line-height: 1.3;
          color: var(--text-primary);
        }
        .summary {
          margin: 0;
          font-size: 12px;
          line-height: 1.4;
          color: var(--text-secondary);
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          line-clamp: 3;
          overflow: hidden;
        }
        .stats {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 8px 14px;
        }
        .stat {
          margin: 0;
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .stat-value {
          font-size: 1.15rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          color: var(--text-primary);
        }
        .stat.pos .stat-value {
          color: var(--pos);
        }
        .stat.neg .stat-value {
          color: var(--neg);
        }
        .stat-label,
        .sample {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .sample {
          margin: 0;
        }
        .foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          padding-top: 2px;
          border-top: 1px solid var(--border);
          margin-top: 2px;
        }
        .conf {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .card :global(.cta) {
          font-size: 12px;
          font-weight: 650;
          color: var(--accent-text, var(--accent));
          text-decoration: none;
          white-space: nowrap;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          font-family: inherit;
        }
        .card :global(.cta:hover) {
          text-decoration: underline;
        }
        .card :global(.cta:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
          border-radius: 2px;
        }
        .card :global(.cta.disabled) {
          opacity: 0.5;
          cursor: default;
          text-decoration: none;
        }
      `}</style>
    </article>
  );
}

export function AttentionGrid({
  findings,
  early = false,
}: {
  findings: Finding[];
  early?: boolean;
}) {
  if (!findings.length) return null;

  return (
    <section className="attention" aria-labelledby="attention-title">
      <header className="section-head">
        <h2 id="attention-title">Things worth your attention</h2>
        <p className="sub">
          {findings.length} additional pattern{findings.length === 1 ? "" : "s"} from your filtered
          sample.
        </p>
      </header>
      <div className="grid">
        {findings.map((finding) => (
          <AttentionCard key={finding.id} finding={finding} early={early} />
        ))}
      </div>
      <style jsx>{`
        .attention {
          display: grid;
          gap: 12px;
        }
        .section-head {
          display: grid;
          gap: 4px;
        }
        h2 {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-primary);
        }
        .sub {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 1100px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 700px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

export function AttentionGridSkeleton() {
  return (
    <div className="skel" aria-hidden>
      <div className="label" />
      <div className="grid">
        <div className="card" />
        <div className="card" />
        <div className="card" />
      </div>
      <style jsx>{`
        .skel {
          display: grid;
          gap: 12px;
        }
        .label {
          width: 220px;
          height: 12px;
          border-radius: 4px;
          background: var(--surface-2);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .card {
          height: 160px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
        }
        @media (max-width: 700px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
