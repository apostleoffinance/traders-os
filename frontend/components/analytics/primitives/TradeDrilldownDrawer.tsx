"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { buildAnalyticsQuery, type FilterState } from "@/lib/analytics";
import type { DrilldownTrade } from "@/lib/analytics-drilldown";
import { formatWhen, money, num, sessionLabel, signed } from "@/lib/format";

type Props = {
  open: boolean;
  title: string;
  accountId: string;
  filters: FilterState;
  currency: string;
  timezone?: string;
  onClose: () => void;
};

export function TradeDrilldownDrawer({ open, title, accountId, filters, currency, timezone, onClose }: Props) {
  const [trades, setTrades] = useState<DrilldownTrade[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    const requestId = ++requestVersion.current;
    if (!open || !accountId) {
      setLoading(false);
      setTrades([]);
      setTotal(0);
      setError(null);
      setLoadingMore(false);
      return () => {
        requestVersion.current += 1;
      };
    }

    setLoading(true);
    setTrades([]);
    setTotal(0);
    setError(null);
    setLoadingMore(false);
    const q = buildAnalyticsQuery(accountId, filters);
    void api<{ trades: DrilldownTrade[]; meta: { total: number } }>(`/api/analytics/trades?${q}&limit=100&offset=0`)
      .then((res) => {
        if (requestId !== requestVersion.current) return;
        setTrades(res.trades);
        setTotal(res.meta.total);
      })
      .catch((e) => {
        if (requestId !== requestVersion.current) return;
        setError(e instanceof Error ? e.message : "Failed to load trades");
      })
      .finally(() => {
        if (requestId === requestVersion.current) setLoading(false);
      });

    return () => {
      requestVersion.current += 1;
    };
  }, [open, accountId, filters]);

  async function loadMore() {
    const requestId = requestVersion.current;
    if (loading || loadingMore || trades.length >= total) return;
    setLoadingMore(true);
    setError(null);
    const q = buildAnalyticsQuery(accountId, filters);
    try {
      const res = await api<{ trades: DrilldownTrade[]; meta: { total: number } }>(
        `/api/analytics/trades?${q}&limit=100&offset=${trades.length}`,
      );
      if (requestId !== requestVersion.current) return;
      setTrades((current) => {
        const knownIds = new Set(current.map((trade) => trade.id));
        return [...current, ...res.trades.filter((trade) => !knownIds.has(trade.id))];
      });
      setTotal(res.meta.total);
    } catch (e) {
      if (requestId === requestVersion.current) {
        setError(e instanceof Error ? e.message : "Failed to load more trades");
      }
    } finally {
      if (requestId === requestVersion.current) setLoadingMore(false);
    }
  }

  if (!open) return null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} />
      <aside className="drawer">
        <header>
          <div>
            <h2>{title}</h2>
            <p className="muted">{loading ? "Loading…" : `${total} trade${total === 1 ? "" : "s"} match filters`}</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {error && <p className="error">{error}</p>}
        {!loading && !error && trades.length === 0 && <p className="muted empty">No trades match this selection.</p>}
        <ul className="list">
          {trades.map((t) => (
            <li key={t.id}>
              <Link href={`/trades/${t.id}`} className="trade-link">
                <div className="top">
                  <strong>
                    {t.symbol} · {t.direction}
                  </strong>
                  <span className={Number(t.realized_pnl) >= 0 ? "pos" : "neg"}>
                    {money(t.realized_pnl, currency)}
                    {t.realized_r ? ` · ${signed(t.realized_r)}R` : ""}
                  </span>
                </div>
                <div className="meta muted">
                  {t.trade_timestamp ? formatWhen(t.trade_timestamp, timezone) : "—"} · {sessionLabel(t.session)}
                  {t.setup_name ? ` · ${t.setup_name}` : ""} · {t.result}
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {trades.length < total && !loading && (
          <button type="button" className="load-more" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading more…" : `Load more trades (${trades.length} of ${total})`}
          </button>
        )}
      </aside>
      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          justify-content: flex-end;
        }
        .scrim {
          position: absolute;
          inset: 0;
          border: 0;
          background: color-mix(in srgb, var(--bg) 40%, transparent);
          cursor: pointer;
        }
        .drawer {
          position: relative;
          width: min(480px, 100%);
          height: 100%;
          background: var(--surface);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          box-shadow: -8px 0 32px rgba(0, 0, 0, 0.15);
        }
        header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 18px;
          border-bottom: 1px solid var(--border);
        }
        h2 {
          margin: 0;
          font-size: 16px;
        }
        .muted {
          font-size: 12px;
          color: var(--muted);
          margin: 4px 0 0;
        }
        .error {
          color: var(--neg);
          padding: 12px 18px;
          font-size: 13px;
        }
        .empty {
          padding: 18px;
        }
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          overflow: auto;
          flex: 1;
        }
        li {
          border-bottom: 1px solid var(--border);
        }
        .trade-link {
          display: block;
          padding: 12px 18px;
          text-decoration: none;
          color: inherit;
        }
        .trade-link:hover {
          background: var(--surface-2);
        }
        .load-more {
          margin: 12px 18px 18px;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
          color: inherit;
          font: inherit;
          cursor: pointer;
        }
        .load-more:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        .top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 14px;
        }
        .meta {
          font-size: 12px;
          margin-top: 4px;
        }
        .pos {
          color: var(--pos);
        }
        .neg {
          color: var(--neg);
        }
      `}</style>
    </div>
  );
}
