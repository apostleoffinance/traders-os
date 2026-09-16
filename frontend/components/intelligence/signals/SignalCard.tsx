"use client";

import type { Finding } from "@/lib/intelligence";
import { toSignalViewModel } from "@/lib/intelligence/signal-ui";
import { EvidenceStrip } from "../EvidenceStrip";
import { InvestigateButton } from "../InvestigateButton";

export function SignalCard({
  finding,
  featured = false,
  selected = false,
  onSelect,
}: {
  finding: Finding;
  featured?: boolean;
  selected?: boolean;
  onSelect?: (finding: Finding) => void;
}) {
  const vm = toSignalViewModel(finding);
  const metric = finding.metric;

  return (
    <article
      className={`card status-${vm.status} ${featured ? "featured" : ""} ${selected ? "selected" : ""} ${onSelect ? "selectable" : ""}`}
      aria-label={`${vm.statusLabel}: ${finding.title}`}
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
        <span className="status">{vm.statusLabel}</span>
        <span className="cat">{vm.categoryLabel}</span>
      </header>

      <h3 className="title">{finding.title}</h3>

      {metric ? (
        <p className={`metric ${metric.tone ?? "neutral"}`}>
          <span className="value">{metric.value}</span>
          <span className="label">{metric.label}</span>
        </p>
      ) : null}

      <p className="support">
        {vm.sampleLabel}
        {finding.evidence[0] ? ` · ${finding.evidence[0].value}` : ""}
        {finding.evidence[1] ? ` · ${finding.evidence[1].value}` : ""}
      </p>

      {featured ? (
        <EvidenceStrip
          evidence={finding.evidence.slice(0, 3)}
          comparison={finding.comparison}
          compact={!featured}
          prominent={featured}
        />
      ) : finding.comparison ? (
        <EvidenceStrip evidence={[]} comparison={finding.comparison} compact />
      ) : null}

      <p className="summary">{vm.summaryLine}</p>

      <footer className="foot">
        <span className="conf">{vm.confidenceLabel}</span>
        <span
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <InvestigateButton finding={finding} label={featured ? vm.ctaLabel : "Inspect"} />
        </span>
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
        .featured {
          padding: 16px 16px 12px;
          border-radius: 12px;
          gap: 10px;
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
        .status-positive {
          border-left-color: var(--pos);
        }
        .status-watch {
          border-left-color: color-mix(in srgb, var(--warning, #e8a838) 80%, var(--border));
        }
        .status-observe {
          border-left-color: color-mix(in srgb, var(--accent) 55%, var(--border));
        }
        .status-risk {
          border-left-color: var(--neg);
        }
        .status-info {
          border-left-color: color-mix(in srgb, var(--accent) 40%, var(--border));
        }
        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .status {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--accent-text, var(--accent));
        }
        .status-risk .status {
          color: var(--neg);
        }
        .status-positive .status {
          color: var(--pos);
        }
        .cat {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .title {
          margin: 0;
          font-size: 14px;
          font-weight: 650;
          line-height: 1.3;
          color: var(--text-primary);
        }
        .featured .title {
          font-size: clamp(1.15rem, 2.2vw, 1.4rem);
          letter-spacing: -0.015em;
          max-width: 36ch;
        }
        .metric {
          margin: 0;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .value {
          font-size: 1.25rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          color: var(--text-primary);
        }
        .featured .value {
          font-size: clamp(1.6rem, 2.8vw, 2rem);
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
        .support {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
        }
        .summary {
          margin: 0;
          font-size: 13px;
          line-height: 1.4;
          color: var(--text-secondary);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-clamp: 2;
          overflow: hidden;
        }
        .featured .summary {
          -webkit-line-clamp: 3;
          line-clamp: 3;
          max-width: 58ch;
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
        .conf {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
        }
        .card :global(.cta) {
          font-size: 12px;
          font-weight: 650;
          color: var(--accent-text, var(--accent));
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          font-family: inherit;
        }
        .featured :global(.cta) {
          display: inline-flex;
          padding: 8px 14px;
          border-radius: 8px;
          background: var(--accent);
          color: var(--accent-contrast);
          font-size: 13px;
        }
        .card :global(.cta:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
          border-radius: 2px;
        }
      `}</style>
    </article>
  );
}
