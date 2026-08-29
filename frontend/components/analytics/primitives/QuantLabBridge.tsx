"use client";

import Link from "next/link";
import { getQuantStudy, getQuantStudyMeta, type QuantStudyId } from "@/lib/analytics/quant-studies";

type BridgeItem = {
  studyId: QuantStudyId;
};

const DEFAULT_PERFORMANCE_STUDIES: BridgeItem[] = [
  { studyId: "return_distribution" },
  { studyId: "rolling_expectancy" },
  { studyId: "bootstrap_expectancy" },
  { studyId: "loss_streak_distribution" },
];

const DEFAULT_BEHAVIOUR_STUDIES: BridgeItem[] = [{ studyId: "loss_streak_distribution" }];

const DEFAULT_RISK_STUDIES: BridgeItem[] = [
  { studyId: "drawdown_research" },
  { studyId: "monte_carlo" },
  { studyId: "risk_of_ruin" },
];

export function QuantLabBridge({
  variant = "performance",
  studies,
  compact = false,
}: {
  variant?: "performance" | "behaviour" | "risk" | "custom";
  studies?: BridgeItem[];
  compact?: boolean;
}) {
  const items =
    studies ??
    (variant === "behaviour"
      ? DEFAULT_BEHAVIOUR_STUDIES
      : variant === "risk"
        ? DEFAULT_RISK_STUDIES
        : DEFAULT_PERFORMANCE_STUDIES);

  return (
    <section className={`bridge ${compact ? "compact" : ""}`}>
      {!compact && (
        <>
          <h3 className="heading">Quant Lab research</h3>
          <p className="lead">
            Statistical distributions, bootstrap confidence, and simulation tools live in Quant Lab — separate from everyday
            analytics so you can opt in when you want deeper validation.
          </p>
        </>
      )}
      <div className="grid">
        {items.map(({ studyId }) => {
          const def = getQuantStudy(studyId);
          const meta = getQuantStudyMeta(studyId);
          if (!def) return null;
          return (
            <Link key={studyId} href={`/quant-lab?tab=${meta.tab}`} className="card">
              <span className="tier">Quant research</span>
              <strong>{def.title}</strong>
              <span className="question">{def.primaryQuestion}</span>
              <span className="value">{def.traderValue}</span>
              <span className="cta">Open in Quant Lab →</span>
            </Link>
          );
        })}
        <Link href="/quant-lab" className="card all">
          <span className="tier">Full lab</span>
          <strong>All quant studies</strong>
          <span className="value">Monte Carlo, walk-forward, edge confidence, and robustness suites.</span>
          <span className="cta">Open Quant Lab →</span>
        </Link>
      </div>
      <style jsx>{`
        .bridge {
          margin: 8px 0 16px;
        }
        .compact {
          margin: 0;
        }
        .heading {
          margin: 0 0 4px;
          font-size: 16px;
        }
        .lead {
          margin: 0 0 14px;
          font-size: 13px;
          color: var(--text-muted);
          max-width: 58ch;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 10px;
        }
        .card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          border: 1px dashed var(--border);
          border-radius: 10px;
          padding: 14px 16px;
          background: var(--surface);
          text-decoration: none;
          color: inherit;
          transition: border-color 0.15s;
        }
        .card:hover {
          border-color: var(--accent);
        }
        .card.all {
          border-style: solid;
          background: color-mix(in srgb, var(--accent) 6%, var(--surface));
        }
        .tier {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--accent);
        }
        .card strong {
          font-size: 14px;
        }
        .question {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
        }
        .value {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
          flex: 1;
        }
        .cta {
          margin-top: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
        }
      `}</style>
    </section>
  );
}
