"use client";

import Link from "next/link";
import type { InvestigationItem } from "@/lib/analytics/investigation";
import { SampleSizeBadge } from "@/components/analytics/insights/SampleSizeBadge";

const ICON: Record<InvestigationItem["severity"], string> = {
  positive: "✓",
  warn: "⚠",
  info: "◆",
};

type TabId = "overview" | "performance" | "edge" | "behaviour" | "execution" | "risk" | "calendar";

export function InvestigationCard({
  item,
  onTabChange,
}: {
  item: InvestigationItem;
  onTabChange?: (tab: TabId) => void;
}) {
  const action =
    item.href ? (
      <Link href={item.href} className="action">
        Investigate →
      </Link>
    ) : item.tab && onTabChange ? (
      <button type="button" className="action" onClick={() => onTabChange(item.tab as TabId)}>
        Investigate →
      </button>
    ) : item.tab ? (
      <Link href={`/analytics?tab=${item.tab}`} className="action">
        Investigate →
      </Link>
    ) : null;

  return (
    <article className={`card ${item.severity}`}>
      <span className="icon" aria-hidden>
        {ICON[item.severity]}
      </span>
      <div className="body">
        <strong>{item.title}</strong>
        <p>{item.summary}</p>
        {item.sampleSize != null && <SampleSizeBadge n={item.sampleSize} />}
        {action}
      </div>
      <style jsx>{`
        .card {
          display: grid;
          grid-template-columns: 28px 1fr;
          gap: 10px;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
        }
        .positive {
          border-left: 3px solid var(--success);
        }
        .warn {
          border-left: 3px solid var(--warning, var(--accent));
        }
        .info {
          border-left: 3px solid var(--border);
        }
        .icon {
          font-size: 14px;
          line-height: 1.4;
        }
        strong {
          display: block;
          font-size: 13px;
          margin-bottom: 4px;
        }
        p {
          margin: 0 0 8px;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .action {
          display: inline-block;
          margin-top: 4px;
          border: none;
          background: transparent;
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          text-decoration: none;
        }
      `}</style>
    </article>
  );
}

export function InvestigationQueue({
  items,
  onTabChange,
}: {
  items: InvestigationItem[];
  onTabChange?: (tab: TabId) => void;
}) {
  if (!items.length) return null;

  return (
    <section className="queue">
      <h2 className="title">What to investigate next</h2>
      <p className="lead">Deterministic signals from your journal — association, not causation.</p>
      <div className="cards">
        {items.map((item) => (
          <InvestigationCard key={item.id} item={item} onTabChange={onTabChange} />
        ))}
      </div>
      <style jsx>{`
        .queue {
          margin: 8px 0 16px;
        }
        .title {
          margin: 0 0 4px;
          font-size: 18px;
        }
        .lead {
          margin: 0 0 14px;
          font-size: 14px;
          color: var(--text-muted);
        }
        .cards {
          display: grid;
          gap: 10px;
        }
      `}</style>
    </section>
  );
}
