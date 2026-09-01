"use client";

import { useState } from "react";
import Link from "next/link";
import type { IntelligenceFeedResponse, IntelligenceInsight } from "@/lib/intelligence";
import { PERIOD_LABELS } from "@/lib/filters";

function severityIcon(severity: string): string {
  if (severity === "positive") return "🟢";
  if (severity === "warn") return "⚠";
  if (severity === "danger") return "⛔";
  return "◆";
}

function InsightCard({ insight, defaultOpen }: { insight: IntelligenceInsight; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <article className={`insight ${insight.severity}`} id={insight.id}>
      <button type="button" className="head" onClick={() => setOpen((v) => !v)}>
        <span className="icon">{severityIcon(insight.severity)}</span>
        <div className="copy">
          <span className="type">{insight.type}</span>
          <strong>{insight.title}</strong>
          <p>{insight.summary}</p>
        </div>
        <span className="chev">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="body">
          <div className="why">
            <span className="lbl">Why am I seeing this?</span>
            <p>{insight.why}</p>
          </div>
          <div className="evidence">
            <span className="lbl">Evidence</span>
            <p>
              {insight.evidence.label} · n={insight.evidence.n} · {insight.evidence.reason}
            </p>
          </div>
          {insight.comparison && (
            <div className="comparison">
              <span className="lbl">Comparison</span>
              <p>
                <strong>{insight.comparison.subject}</strong> ({insight.comparison.subject_value}) vs{" "}
                <strong>{insight.comparison.baseline}</strong> ({insight.comparison.baseline_value})
              </p>
            </div>
          )}
          {insight.action && (
            <Link href={insight.action.href} className="action">
              {insight.action.label} →
            </Link>
          )}
        </div>
      )}
      <style jsx>{`
        .insight {
          border: 1px solid var(--line);
          background: var(--surface);
        }
        .insight.positive {
          border-left: 3px solid var(--success);
        }
        .insight.warn {
          border-left: 3px solid var(--warning);
        }
        .insight.danger {
          border-left: 3px solid var(--danger);
        }
        .head {
          width: 100%;
          display: grid;
          grid-template-columns: 28px 1fr 20px;
          gap: 10px;
          align-items: start;
          padding: 14px 16px;
          border: 0;
          background: transparent;
          text-align: left;
          cursor: pointer;
          color: inherit;
        }
        .icon {
          font-size: 16px;
          line-height: 1.4;
        }
        .type {
          display: block;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
          margin-bottom: 4px;
        }
        .copy strong {
          display: block;
          font-size: 15px;
          margin-bottom: 4px;
        }
        .copy p {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .chev {
          font-size: 18px;
          color: var(--text-secondary);
        }
        .body {
          padding: 0 16px 14px 54px;
          display: grid;
          gap: 10px;
        }
        .lbl {
          display: block;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
          margin-bottom: 4px;
        }
        .why p,
        .evidence p,
        .comparison p {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
        }
        .action {
          font-size: 13px;
          font-weight: 600;
          color: var(--accent);
          text-decoration: none;
        }
        .action:hover {
          text-decoration: underline;
        }
      `}</style>
    </article>
  );
}

function InsightSection({
  title,
  items,
  empty,
}: {
  title: string;
  items: IntelligenceInsight[];
  empty?: string;
}) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {items.length === 0 ? (
        <p className="muted">{empty ?? "No insights in this section."}</p>
      ) : (
        <div className="list">
          {items.map((ins) => (
            <InsightCard key={ins.id} insight={ins} />
          ))}
        </div>
      )}
      <style jsx>{`
        .section {
          display: grid;
          gap: 10px;
        }
        h2 {
          margin: 0;
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
        }
        .list {
          display: grid;
          gap: 8px;
        }
        .muted {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
        }
      `}</style>
    </section>
  );
}

export function IntelligenceFeedPanel({
  data,
  tradesInPeriod,
}: {
  data: IntelligenceFeedResponse;
  tradesInPeriod?: number;
}) {
  const period = PERIOD_LABELS[data.filters.preset as keyof typeof PERIOD_LABELS] ?? data.filters.preset;

  const patternsEmpty =
    tradesInPeriod === 0
      ? `No closed trades opened or closed in ${period}. Change the period or log trades in this window.`
      : tradesInPeriod != null && tradesInPeriod < 10
        ? `${tradesInPeriod} trade${tradesInPeriod === 1 ? "" : "s"} in ${period} — pattern insights usually need at least 10. Try a longer period.`
        : `No pattern insights for ${period} yet. Risk and behaviour cards above may still apply.`;

  return (
    <div className="feed">
      <div className="summary-bar">
        <div>
          <span className="kicker">Live feed</span>
          <p className="counts">
            <strong>{data.summary.total}</strong> insights · {period}
            {data.summary.warnings > 0 && (
              <span className="warn-count"> · {data.summary.warnings} need attention</span>
            )}
          </p>
        </div>
        <p className="muted">Deterministic — every insight shows sample size and evidence. Not trade signals.</p>
      </div>

      <InsightSection
        title="Today"
        items={data.feed.today}
        empty="No trades logged today yet."
      />

      <InsightSection
        title={`Patterns · ${period}`}
        items={data.feed.insights}
        empty={patternsEmpty}
      />

      <style jsx>{`
        .feed {
          display: grid;
          gap: 18px;
        }
        .summary-bar {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          padding-bottom: 4px;
        }
        .kicker {
          display: block;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
          margin-bottom: 4px;
        }
        .counts {
          margin: 0;
          font-size: 15px;
        }
        .warn-count {
          color: var(--warning);
        }
        .muted {
          margin: 0;
          max-width: 280px;
          font-size: 12px;
          color: var(--text-secondary);
          text-align: right;
          line-height: 1.4;
        }
        @media (max-width: 700px) {
          .summary-bar {
            flex-direction: column;
          }
          .muted {
            text-align: left;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}
