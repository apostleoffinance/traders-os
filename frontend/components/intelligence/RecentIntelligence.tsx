"use client";

import type { Finding } from "@/lib/intelligence";
import { findingTypeLabel } from "./EvidenceStrip";
import { InvestigateButton } from "./InvestigateButton";

type DayGroup = {
  key: string;
  label: string;
  items: Finding[];
};

export function RecentIntelligence({ findings }: { findings: Finding[] }) {
  if (!findings.length) return null;

  const groups = groupByDay(findings);

  return (
    <section className="recent" aria-labelledby="recent-intel-title">
      <header className="section-head">
        <h2 id="recent-intel-title">Recent intelligence</h2>
        <p className="sub">Chronological findings from this session — open evidence in the related lab.</p>
      </header>

      <div className="timeline">
        {groups.map((group) => (
          <div key={group.key} className="day">
            <h3 className="day-label">
              <time dateTime={group.key}>{group.label}</time>
            </h3>
            <ul className="items">
              {group.items.map((finding) => (
                <li key={finding.id} className={`item sev-${finding.severity.toLowerCase()}`}>
                  <div className="body">
                    <span className="type">{findingTypeLabel(finding.type)}</span>
                    <strong className="title">{finding.title}</strong>
                    {finding.summary ? <p className="summary">{finding.summary}</p> : null}
                    <div className="facts">
                      {finding.metric ? (
                        <span className={`metric ${finding.metric.tone ?? "neutral"}`}>
                          {finding.metric.value}
                        </span>
                      ) : null}
                      {finding.sampleSize > 0 ? (
                        <span className="sample">
                          {finding.sampleSize} trade{finding.sampleSize === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <InvestigateButton finding={finding} label="View evidence →" className="view" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <style jsx>{`
        .recent {
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
        .timeline {
          display: grid;
          gap: 16px;
        }
        .day {
          display: grid;
          gap: 8px;
        }
        .day-label {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .items {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .item {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          border-left: 3px solid var(--border);
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
          border-left-color: color-mix(in srgb, var(--accent) 45%, var(--border));
        }
        .body {
          min-width: 0;
          display: grid;
          gap: 4px;
        }
        .type {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--accent-text, var(--accent));
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
        .facts {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 12px;
          margin-top: 2px;
        }
        .metric {
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          color: var(--text-primary);
        }
        .metric.pos {
          color: var(--pos);
        }
        .metric.neg {
          color: var(--neg);
        }
        .sample {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
        }
        .recent :global(.view) {
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
        .recent :global(.view.disabled) {
          opacity: 0.5;
          cursor: default;
        }
        .recent :global(.view:hover) {
          text-decoration: underline;
        }
        .recent :global(.view:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
          border-radius: 2px;
        }
        @media (max-width: 700px) {
          .item {
            grid-template-columns: 1fr;
          }
          .recent :global(.view) {
            justify-self: start;
          }
        }
      `}</style>
    </section>
  );
}

export function RecentIntelligenceSkeleton() {
  return (
    <div className="skel" aria-hidden>
      <div className="label" />
      <div className="row" />
      <div className="row" />
      <style jsx>{`
        .skel {
          display: grid;
          gap: 8px;
        }
        .label {
          width: 160px;
          height: 12px;
          border-radius: 4px;
          background: var(--surface-2);
          margin-bottom: 4px;
        }
        .row {
          height: 64px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
        }
      `}</style>
    </div>
  );
}

function groupByDay(findings: Finding[]): DayGroup[] {
  const map = new Map<string, Finding[]>();
  for (const finding of findings) {
    const key = dayKey(finding.createdAt);
    const list = map.get(key) ?? [];
    list.push(finding);
    map.set(key, list);
  }

  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, items]) => ({
      key,
      label: dayLabel(key),
      items,
    }));
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(key: string): string {
  if (key === "unknown") return "This window";
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}
