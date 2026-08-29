"use client";

import Link from "next/link";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { money, signed } from "@/lib/format";

type TradeRank = {
  trade_id: string;
  symbol: string;
  setup: string;
  direction: string;
  net_pnl: string;
  r_multiple?: string | null;
  discipline_score?: number | null;
  entry_at: string;
};

export function ReportTradesSection({
  highlights,
  decisionQuality,
  currency,
}: {
  highlights: { best: unknown[]; worst: unknown[] };
  decisionQuality: Record<string, unknown>;
  currency: string;
}) {
  const best = highlights.best as TradeRank[];
  const worst = highlights.worst as TradeRank[];
  const labels = decisionQuality.labels as Record<string, string> | undefined;
  const counts = decisionQuality.counts as Record<string, number> | undefined;

  return (
    <>
      <h2 className="section-title">Best & worst trades</h2>
      <p className="philosophy">Process and discipline are separate from P/L.</p>
      <div className="grid">
        <ChartCard title="Top trades">
          <TradeList rows={best} currency={currency} positive />
        </ChartCard>
        <ChartCard title="Worst trades">
          <TradeList rows={worst} currency={currency} positive={false} />
        </ChartCard>
      </div>
      {counts && labels && (
        <ChartCard title="Good loss / bad win highlights">
          <ul className="highlights">
            <li>
              <span className="good">{labels.good_loss}</span> — {counts.good_loss ?? 0} trades
            </li>
            <li>
              <span className="bad">{labels.lucky_win}</span> — {counts.lucky_win ?? 0} trades
            </li>
          </ul>
        </ChartCard>
      )}
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 8px;
        }
        .philosophy {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 16px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .highlights {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .good {
          color: var(--pos);
        }
        .bad {
          color: var(--neg);
        }
        @media (max-width: 800px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

function TradeList({ rows, currency, positive }: { rows: TradeRank[]; currency: string; positive: boolean }) {
  if (!rows.length) return <p className="muted">No trades.</p>;
  return (
    <ol className="list">
      {rows.map((r) => (
        <li key={r.trade_id}>
          <Link href={`/trades/${r.trade_id}`} className="row">
            <strong>
              {r.symbol} · {r.setup}
            </strong>
            <span className={positive ? "pos" : "neg"}>
              {r.r_multiple ? `${signed(r.r_multiple)}R` : money(r.net_pnl, currency)}
            </span>
          </Link>
        </li>
      ))}
      <style jsx>{`
        .list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          padding: 10px 4px;
          border-bottom: 1px solid var(--border);
          text-decoration: none;
          color: inherit;
        }
        .pos {
          color: var(--pos);
        }
        .neg {
          color: var(--neg);
        }
        .muted {
          color: var(--muted);
        }
      `}</style>
    </ol>
  );
}
