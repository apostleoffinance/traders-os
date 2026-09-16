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

/** Compact Quant Lab links — no research essays in Analytics. */
export function QuantLabBridge({
  variant = "performance",
  studies,
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
    <section className="bridge">
      <div className="links">
        {items.map(({ studyId }) => {
          const def = getQuantStudy(studyId);
          const meta = getQuantStudyMeta(studyId);
          if (!def) return null;
          return (
            <Link key={studyId} href={`/quant-lab?tab=${meta.tab}`} className="link">
              {def.title}
            </Link>
          );
        })}
        <Link href="/quant-lab" className="link all">
          Quant Lab →
        </Link>
      </div>
      <style jsx>{`
        .bridge {
          margin: 8px 0 0;
        }
        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
        }
        .link {
          font-size: 13px;
          font-weight: 600;
          color: var(--accent);
          text-decoration: none;
        }
        .link:hover {
          text-decoration: underline;
        }
        .all {
          color: var(--text-secondary);
        }
      `}</style>
    </section>
  );
}
