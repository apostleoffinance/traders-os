"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { InvestigationItem } from "@/lib/analytics/investigation";
import { SampleSizeBadge } from "@/components/analytics/insights/SampleSizeBadge";
import { EmptyState } from "@/components/trader/EmptyState";

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
  const actionLabel = item.actionHint ?? "Investigate →";
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
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
      <article className={`card ${item.severity}`}>
        <span className="icon" aria-hidden>
          {ICON[item.severity]}
        </span>
        <div className="body">
          <span className="label">What?</span>
          <strong>{item.title}</strong>
          <span className="label">So what?</span>
          <p>{item.summary}</p>
          {item.sampleSize != null && <SampleSizeBadge n={item.sampleSize} />}
          {action ? (
            <>
              <span className="label now">Now what?</span>
              {action}
            </>
          ) : null}
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
          .label {
            display: block;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            color: var(--accent);
            margin: 6px 0 2px;
          }
          .label:first-child {
            margin-top: 0;
          }
          .label.now {
            margin-top: 8px;
          }
          strong {
            display: block;
            font-size: 13px;
            margin-bottom: 2px;
          }
          p {
            margin: 0 0 6px;
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.4;
          }
          .action {
            display: inline-block;
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
    </motion.div>
  );
}

export function InvestigationQueue({
  items,
  onTabChange,
}: {
  items: InvestigationItem[];
  onTabChange?: (tab: TabId) => void;
}) {
  if (!items.length) {
    return (
      <section className="queue">
        <h2 className="title">What to investigate next</h2>
        <EmptyState title="No urgent investigations">
          <p className="lead">Nothing flagged in this sample — keep journaling and re-check after more trades.</p>
        </EmptyState>
        <style jsx>{`
          .queue {
            margin: 8px 0 16px;
          }
          .title {
            margin: 0 0 10px;
            font-size: 15px;
          }
          .lead {
            margin: 0;
            font-size: 13px;
            color: var(--text-muted);
          }
        `}</style>
      </section>
    );
  }

  return (
    <section className="queue">
      <h2 className="title">What to investigate next</h2>
      <p className="lead">Deterministic signals — WHAT / SO WHAT / NOW WHAT. Association, not causation.</p>
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
          font-size: 15px;
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
