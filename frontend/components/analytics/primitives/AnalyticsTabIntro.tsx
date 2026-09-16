"use client";

import Link from "next/link";
import { getAnalyticsByPage } from "@/lib/analytics/registry";
import type { AnalyticsPageId } from "@/lib/analytics/types";

const TAB_COPY: Record<string, { title: string; lead: string; decision: string }> = {
  performance: {
    title: "Performance",
    lead: "How did I perform? Equity, outcomes, payoff, monthly results, and costs — without the research lab noise.",
    decision: "Read the scorecard and equity path first; deep dive only if something looks off.",
  },
  edge: {
    title: "Edge Explorer",
    lead: "Where is my edge? Rank instruments, setups, and sessions — then dig into time-of-day and advanced maps.",
    decision: "Start with the top ranks; open deep maps only to explain a surprising result.",
  },
  execution: {
    title: "Execution",
    lead: "Am I sizing, holding, and exiting well? Snapshot first — scatters stay in deep dive.",
    decision: "Answer sizing / hold / exit in the L1 strip before opening scatters.",
  },
  behaviour: {
    title: "Behaviour",
    lead: "Is my behavior helping my trading? Process quality, overtrading, risk-after-loss, and emotion tags — scores always explain how they were measured.",
    decision: "Process vs outcome first; emotion maps stay optional.",
  },
  risk: {
    title: "Risk",
    lead: "How much danger am I taking? Limits used, drawdown, and equity underwater — research detail stays collapsed.",
    decision: "Budget gauges answer the decision; recovery research is optional.",
  },
  calendar: {
    title: "Calendar",
    lead: "When did I make or lose the most? Best/worst days first — weekday and monthly research collapsed.",
    decision: "Best/worst day answers first; weekday/monthly compare stays collapsed.",
  },
};

export function AnalyticsTabIntro({ page }: { page: AnalyticsPageId }) {
  const copy = TAB_COPY[page];
  const defs = getAnalyticsByPage(page);
  const essential = defs.filter((d) => d.tier === "essential").length;
  const deep = defs.filter((d) => d.tier === "deep_dive").length;

  if (!copy) return null;

  return (
    <header className="intro">
      <div>
        <p className="hierarchy" aria-label="Progressive disclosure">
          <span>Decision</span>
          <span className="sep">→</span>
          <span>Evidence</span>
          <span className="sep">→</span>
          <span>Deep dive</span>
          <span className="sep">→</span>
          <span>Quant</span>
        </p>
        <h2 className="title">{copy.title}</h2>
        <p className="lead">{copy.lead}</p>
        <p className="decision">
          <strong>Now what?</strong> {copy.decision}
        </p>
        <p className="meta">
          {essential} essential · {deep} deep-dive charts in this section
        </p>
      </div>
      {(page === "performance" || page === "risk") && (
        <Link href="/quant-lab" className="quant-link">
          Open Quant Lab →
        </Link>
      )}
      <style jsx>{`
        .intro {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .hierarchy {
          margin: 0 0 6px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--accent);
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
        }
        .sep {
          color: var(--text-muted);
          font-weight: 500;
        }
        .title {
          margin: 0 0 4px;
          font-size: 16px;
          font-weight: 600;
        }
        .lead {
          margin: 0 0 6px;
          font-size: 14px;
          color: var(--text-muted);
          max-width: 56ch;
        }
        .decision {
          margin: 0 0 6px;
          font-size: 13px;
          color: var(--text-secondary);
          max-width: 56ch;
        }
        .decision strong {
          color: var(--accent);
          font-size: 10px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-right: 6px;
        }
        .meta {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .quant-link {
          font-size: 13px;
          font-weight: 600;
          color: var(--accent);
          text-decoration: none;
          white-space: nowrap;
        }
      `}</style>
    </header>
  );
}
