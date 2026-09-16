"use client";

import type { Finding } from "@/lib/intelligence";
import { confidenceText } from "@/lib/intelligence";
import { EvidenceStrip, findingTypeLabel } from "./EvidenceStrip";
import { InvestigateButton } from "./InvestigateButton";

/** Compact worth-watching cards — metric + mini evidence, not essay cards. */
export function AttentionCard({
  finding,
  selected = false,
  onSelect,
}: {
  finding: Finding;
  selected?: boolean;
  onSelect?: (finding: Finding) => void;
}) {
  const metric = finding.metric;
  const state = confidenceText(finding.confidence, finding.sampleSize);

  return (
    <article
      className={`card sev-${finding.severity.toLowerCase()} ${selected ? "selected" : ""} ${onSelect ? "selectable" : ""}`}
      aria-label={`${findingTypeLabel(finding.type)}: ${finding.title}`}
      aria-pressed={onSelect ? selected : undefined}
      tabIndex={onSelect ? 0 : undefined}
      role={onSelect ? "button" : undefined}
      onClick={onSelect ? () => onSelect(finding) : undefined}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(finding);
              }
            }
          : undefined
      }
    >
      <header className="head">
        <span className="type">{findingTypeLabel(finding.type)}</span>
      </header>

      <h3 className="title">{finding.title}</h3>

      {metric ? (
        <p className={`metric ${metric.tone ?? "neutral"}`}>
          <span className="value">{metric.value}</span>
          <span className="label">{metric.label}</span>
        </p>
      ) : null}

      <EvidenceStrip
        evidence={finding.evidence.slice(0, 2)}
        comparison={finding.comparison}
        compact
      />

      <footer className="foot">
        <span className="state">{state}</span>
        <InvestigateButton finding={finding} label="Explore →" />
      </footer>

      <style jsx>{`
        .card {
          display: grid;
          gap: 8px;
          padding: 12px 12px 10px;
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
        .selectable {
          cursor: pointer;
        }
        .selectable:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .selected {
          box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent);
        }
        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .type {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .title {
          margin: 0;
          font-size: 14px;
          font-weight: 650;
          line-height: 1.3;
          color: var(--text-primary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-clamp: 2;
          overflow: hidden;
        }
        .metric {
          margin: 0;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .value {
          font-size: 1.2rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          color: var(--text-primary);
        }
        .metric.pos .value {
          color: var(--pos);
        }
        .metric.neg .value {
          color: var(--neg);
        }
        .label {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          flex-wrap: wrap;
          padding-top: 6px;
          border-top: 1px solid var(--border);
        }
        .state {
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
  selectedId,
  onSelect,
}: {
  findings: Finding[];
  selectedId?: string | null;
  onSelect?: (finding: Finding) => void;
}) {
  if (!findings.length) return null;

  return (
    <section className="attention" aria-labelledby="watch-title">
      <header className="section-head">
        <h2 id="watch-title">Worth watching</h2>
        <p className="sub">Additional observations from this period.</p>
      </header>
      <div className="grid">
        {findings.map((finding) => (
          <AttentionCard
            key={finding.id}
            finding={finding}
            selected={selectedId === finding.id}
            onSelect={onSelect}
          />
        ))}
      </div>
      <style jsx>{`
        .attention {
          display: grid;
          gap: 10px;
        }
        .section-head {
          display: grid;
          gap: 2px;
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
          gap: 10px;
          align-items: start;
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
          gap: 10px;
        }
        .label {
          width: 160px;
          height: 12px;
          border-radius: 4px;
          background: var(--surface-2);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .card {
          height: 140px;
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
