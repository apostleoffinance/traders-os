"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { money } from "@/lib/format";

export function ReportYearInReviewSection({
  yearInReview,
  currency,
}: {
  yearInReview: Record<string, unknown>;
  currency: string;
}) {
  const timeline = (yearInReview.monthly_timeline ?? []) as { month: string; net_pnl: string | null; n: number }[];
  const bestWorst = yearInReview.best_month as { best?: { month: string; net_pnl: string }; worst?: { month: string; net_pnl: string } } | undefined;

  return (
    <section className="year-review">
      <h2>{String(yearInReview.title ?? "Your trading year in review")}</h2>
      <p className="lede">How you evolved across the year — month by month.</p>
      <div className="highlights">
        {bestWorst?.best && (
          <ChartCard title="Best month">
            <strong>{bestWorst.best.month}</strong>
            <p>{money(bestWorst.best.net_pnl, currency)}</p>
          </ChartCard>
        )}
        {bestWorst?.worst && (
          <ChartCard title="Worst month">
            <strong>{bestWorst.worst.month}</strong>
            <p>{money(bestWorst.worst.net_pnl, currency)}</p>
          </ChartCard>
        )}
      </div>
      {timeline.length > 0 && (
        <ChartCard title="Monthly performance timeline">
          <div className="bars">
            {timeline.map((m) => {
              const pnl = Number(m.net_pnl ?? 0);
              const h = Math.min(100, Math.abs(pnl) / 5);
              return (
                <div key={m.month} className="bar-col" title={`${m.month}: ${money(m.net_pnl ?? "0", currency)} · n=${m.n}`}>
                  <div className={`bar ${pnl >= 0 ? "pos" : "neg"}`} style={{ height: `${Math.max(4, h)}%` }} />
                  <span>{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      )}
      <style jsx>{`
        .year-review h2 {
          font-size: 24px;
          margin: 0 0 8px;
          letter-spacing: 0.03em;
        }
        .lede {
          color: var(--muted);
          margin-bottom: 20px;
        }
        .highlights {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        .bars {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          height: 160px;
        }
        .bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          justify-content: flex-end;
        }
        .bar {
          width: 100%;
          border-radius: 4px 4px 0 0;
          min-height: 4px;
        }
        .bar.pos {
          background: var(--pos);
        }
        .bar.neg {
          background: var(--neg);
        }
        .bar-col span {
          font-size: 9px;
          color: var(--muted);
          margin-top: 4px;
        }
        @media (max-width: 700px) {
          .highlights {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
