"use client";

import type { Finding } from "@/lib/intelligence";
import { toSignalViewModel } from "@/lib/intelligence/signal-ui";
import { InvestigateButton } from "./InvestigateButton";

function investigateLabel(finding: Finding): string {
  const dest = finding.destination.label;
  if (dest && dest !== "Analytics") return `Inspect ${dest.replace(/ Lab$/, "")} →`;
  return finding.action.label || "Inspect →";
}

/** Worth Investigating queue — generated from engine.queue only. */
export function InvestigateNext({ findings }: { findings: Finding[] }) {
  if (!findings.length) return null;

  return (
    <section className="next" aria-labelledby="investigate-next-title">
      <header className="section-head">
        <h2 id="investigate-next-title">Worth investigating</h2>
        <p className="sub">Where to look next — from your own closed trades.</p>
      </header>

      <ol className="list">
        {findings.map((finding, index) => {
          const vm = toSignalViewModel(finding);
          return (
            <li key={finding.id} className={`row status-${vm.status}`}>
              <span className="num" aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="body">
                <div className="meta">
                  <span className="status">{vm.statusLabel}</span>
                  <span className="cat">{vm.categoryLabel}</span>
                </div>
                <strong className="title">{finding.title}</strong>
                <p className="sample">
                  {finding.metric ? `${finding.metric.value}` : ""}
                  {finding.metric && finding.sampleSize > 0 ? " · " : ""}
                  {finding.sampleSize > 0
                    ? `${finding.sampleSize} trade${finding.sampleSize === 1 ? "" : "s"}`
                    : ""}
                </p>
                {finding.summary ? <p className="summary">{finding.summary}</p> : null}
              </div>
              <InvestigateButton finding={finding} label={investigateLabel(finding)} className="action" />
            </li>
          );
        })}
      </ol>

      <style jsx>{`
        .next {
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
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .row {
          display: grid;
          grid-template-columns: 36px 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          border-left: 3px solid var(--border);
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
        .num {
          font-size: 13px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          color: var(--text-muted);
        }
        .body {
          min-width: 0;
          display: grid;
          gap: 4px;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }
        .status {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
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
          font-size: 13px;
          font-weight: 650;
          color: var(--text-primary);
        }
        .summary {
          margin: 0;
          font-size: 12px;
          line-height: 1.35;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sample {
          margin: 0;
          font-size: 12px;
          font-weight: 650;
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
        }
        .next :global(.action) {
          font-size: 12px;
          font-weight: 650;
          color: var(--accent-text, var(--accent));
          text-decoration: none;
          white-space: nowrap;
          justify-self: end;
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          font-family: inherit;
        }
        .next :global(.action.disabled) {
          opacity: 0.5;
          cursor: default;
          text-decoration: none;
        }
        .next :global(.action:hover) {
          text-decoration: underline;
        }
        .next :global(.action:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
          border-radius: 2px;
        }
        @media (max-width: 700px) {
          .row {
            grid-template-columns: 28px 1fr;
            grid-template-rows: auto auto;
          }
          .next :global(.action) {
            grid-column: 2;
            justify-self: start;
          }
        }
      `}</style>
    </section>
  );
}

export function InvestigateNextSkeleton() {
  return (
    <div className="skel" aria-hidden>
      <div className="label" />
      <div className="row" />
      <div className="row" />
      <div className="row" />
      <style jsx>{`
        .skel {
          display: grid;
          gap: 8px;
        }
        .label {
          width: 140px;
          height: 12px;
          border-radius: 4px;
          background: var(--surface-2);
          margin-bottom: 4px;
        }
        .row {
          height: 56px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
        }
      `}</style>
    </div>
  );
}
