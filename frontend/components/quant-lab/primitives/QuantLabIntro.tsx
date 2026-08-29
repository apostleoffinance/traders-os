"use client";

import Link from "next/link";
import { getAllQuantStudies } from "@/lib/analytics/quant-studies";

export function QuantLabIntro() {
  const studies = getAllQuantStudies();

  return (
    <header className="intro">
      <div>
        <p className="kicker">Level 4 · Research environment</p>
        <h2 className="title">Quantitative research</h2>
        <p className="lead">
          Advanced statistical tools isolated from everyday analytics. Every study includes methodology, sample context, and
          explicit limitations — nothing here is a trading signal.
        </p>
        <p className="meta">
          {studies.length} quant studies · bootstrap · Monte Carlo · robustness · walk-forward
        </p>
      </div>
      <Link href="/analytics" className="back-link">
        ← Back to Analytics
      </Link>
      <style jsx>{`
        .intro {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 12px;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: color-mix(in srgb, var(--surface-2, var(--surface)) 35%, var(--surface));
        }
        .kicker {
          margin: 0 0 4px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--accent);
        }
        .title {
          margin: 0 0 6px;
          font-size: 20px;
        }
        .lead {
          margin: 0 0 6px;
          font-size: 14px;
          color: var(--text-muted);
          max-width: 62ch;
        }
        .meta {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .back-link {
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
