"use client";

import Link from "next/link";
import { getAnalyticsByPage } from "@/lib/analytics/registry";
import type { AnalyticsPageId } from "@/lib/analytics/types";
import { AnalyticsTierBadge } from "@/components/analytics/insights/AnalyticsTierBadge";

const TAB_COPY: Record<string, { title: string; lead: string }> = {
  performance: {
    title: "Performance",
    lead: "Deeper profitability metrics, period comparisons, and cost analysis.",
  },
  edge: {
    title: "Edge Explorer",
    lead: "Compare instruments, setups, and sessions to find where your edge shows up.",
  },
  execution: {
    title: "Execution",
    lead: "Position sizing, hold times, and how well you capture favorable movement.",
  },
  behaviour: {
    title: "Behaviour",
    lead: "Psychology, discipline, and patterns after wins and losses.",
  },
  risk: {
    title: "Risk",
    lead: "Drawdowns, capital preservation, and equity research.",
  },
  calendar: {
    title: "Calendar",
    lead: "Day-by-day results and temporal trading patterns.",
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
        <h2 className="title">{copy.title}</h2>
        <p className="lead">{copy.lead}</p>
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
