"use client";

import Link from "next/link";
import type { InvestigationItem } from "@/lib/analytics/investigation";

const ICON: Record<InvestigationItem["severity"], string> = {
  positive: "✓",
  warn: "⚠",
  info: "·",
};

type TabId = "overview" | "performance" | "edge" | "behaviour" | "execution" | "risk" | "calendar";

/** Compact signal row — title + one action, no What/So what pedagogy. */
export function InvestigationCard({
  item,
  onTabChange,
}: {
  item: InvestigationItem;
  onTabChange?: (tab: TabId) => void;
}) {
  const actionLabel = item.actionHint ?? "Open →";
  const action =
    item.href ? (
      <Link href={item.href} className="action">
        {actionLabel}
      </Link>
    ) : item.tab && onTabChange ? (
      <button type="button" className="action" onClick={() => onTabChange(item.tab as TabId)}>
        {actionLabel}
      </button>
    ) : item.tab ? (
      <Link href={`/analytics?tab=${item.tab}`} className="action">
        {actionLabel}
      </Link>
    ) : null;

  return (
    <article className={`row ${item.severity}`}>
      <span className="icon" aria-hidden>
        {ICON[item.severity]}
      </span>
      <div className="body">
        <strong>{item.title}</strong>
        {item.summary ? <span className="summary">{item.summary}</span> : null}
      </div>
      {action}
      <style jsx>{`
        .row {
          display: grid;
          grid-template-columns: 20px 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
        }
        .positive {
          border-left: 3px solid var(--success, var(--pos));
        }
        .warn {
          border-left: 3px solid var(--warning, var(--accent));
        }
        .info {
          border-left: 3px solid var(--border);
        }
        .icon {
          font-size: 13px;
          color: var(--text-secondary);
        }
        .body {
          min-width: 0;
        }
        strong {
          display: block;
          font-size: 13px;
          font-weight: 600;
        }
        .summary {
          display: block;
          margin-top: 2px;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .action {
          border: none;
          background: transparent;
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          text-decoration: none;
          white-space: nowrap;
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
    <section className="queue" aria-label="Signals">
      <div className="cards">
        {items.map((item) => (
          <InvestigationCard key={item.id} item={item} onTabChange={onTabChange} />
        ))}
      </div>
      <style jsx>{`
        .queue {
          margin: 4px 0 0;
        }
        .cards {
          display: grid;
          gap: 8px;
        }
      `}</style>
    </section>
  );
}
