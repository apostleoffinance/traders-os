"use client";

import Link from "next/link";
import { Panel } from "@/components/ui";
import type { AnalyticsDashboard, LabTradeRank } from "@/lib/analytics";
import { formatWhen, money, signed } from "@/lib/format";

function TradeList({
  title,
  rows,
  currency,
  timezone,
  positive,
}: {
  title: string;
  rows: LabTradeRank[];
  currency: string;
  timezone: string;
  positive: boolean;
}) {
  if (!rows.length) return null;
  const maxR = Math.max(...rows.map((r) => Math.abs(Number(r.r_multiple ?? 0))), 0.01);

  return (
    <Panel title={title}>
      <ol className="list">
        {rows.slice(0, 5).map((r) => {
          const rVal = Math.abs(Number(r.r_multiple ?? 0));
          const width = Math.min(100, (rVal / maxR) * 100);
          return (
            <li key={r.trade_id}>
              <Link href={`/trades/${r.trade_id}`} className="row">
                <span className="rank">{String(r.rank).padStart(2, "0")}</span>
                <div className="body">
                  <div className="top">
                    <strong>
                      {r.symbol} · {r.setup}
                    </strong>
                    <span className={positive ? "pos" : "neg"}>
                      {r.r_multiple ? `${signed(r.r_multiple)}R` : money(r.net_pnl, currency)}
                    </span>
                  </div>
                  <div className={`bar ${positive ? "pos" : "neg"}`} style={{ width: `${width}%` }} />
                  <span className="meta">
                    {formatWhen(r.entry_at, timezone)} · {r.direction}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
      <style jsx>{`
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        li {
          border-bottom: 1px solid var(--border);
        }
        .row {
          display: flex;
          gap: 10px;
          padding: 10px 4px;
          text-decoration: none;
          color: inherit;
        }
        .row:hover {
          background: var(--surface-2);
        }
        .rank {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          color: var(--text-muted);
          min-width: 24px;
        }
        .body {
          flex: 1;
          min-width: 0;
        }
        .top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 13px;
        }
        .bar {
          height: 6px;
          border-radius: 3px;
          margin: 6px 0 4px;
        }
        .bar.pos {
          background: var(--pos);
        }
        .bar.neg {
          background: var(--neg);
        }
        .meta {
          font-size: 11px;
          color: var(--text-muted);
        }
        .pos {
          color: var(--pos);
          font-family: var(--font-mono), monospace;
        }
        .neg {
          color: var(--neg);
          font-family: var(--font-mono), monospace;
        }
      `}</style>
    </Panel>
  );
}

export function OverviewBestTrades({ data }: { data: AnalyticsDashboard }) {
  const lab = data.lab;
  if (!lab || lab.metadata.sample_size === 0) return null;

  const bt = lab.performance.best_trades;
  const currency = data.account.currency;
  const timezone = lab.metadata.timezone;

  if (!bt.winners.length && !bt.losers.length) return null;

  return (
    <section className="section">
      <h2 className="section-title">Best & worst trades</h2>
      <p className="section-lead">Your largest observed outcomes in this sample.</p>
      <div className="pair">
        <TradeList title="Top trades" rows={bt.winners} currency={currency} timezone={timezone} positive />
        <TradeList title="Worst trades" rows={bt.losers} currency={currency} timezone={timezone} positive={false} />
      </div>
      <style jsx>{`
        .section {
          margin-bottom: 8px;
        }
        .section-title {
          margin: 0 0 4px;
          font-size: 15px;
        }
        .section-lead {
          margin: 0 0 14px;
          font-size: 14px;
          color: var(--text-muted);
        }
        .pair {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 900px) {
          .pair {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
