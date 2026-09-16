"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, getActiveAccountId } from "@/lib/api";
import { buildAnalyticsQuery, type FilterState } from "@/lib/analytics";
import type { DrilldownTrade } from "@/lib/analytics-drilldown";
import { filterForSingleDay, formatDrillDayLabel } from "@/lib/analytics-drilldown";
import type { CalendarDay } from "@/lib/analytics/calendar-view";
import { dayPerformanceValue } from "@/lib/analytics/calendar-view";
import { formatWhen, money, sessionLabel, signed, tone } from "@/lib/format";

/**
 * Day investigation drawer — loads day trades without mutating global filters.
 */
export function DayInvestigation({
  day,
  baseFilters,
  currency,
  timezone,
  onClose,
}: {
  day: CalendarDay | null;
  baseFilters: FilterState;
  currency: string;
  timezone?: string;
  onClose: () => void;
}) {
  const open = day != null;
  const [trades, setTrades] = useState<DrilldownTrade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayFilters = useMemo(() => {
    if (!day) return null;
    return { ...baseFilters, ...filterForSingleDay(day.date) };
  }, [day, baseFilters]);

  useEffect(() => {
    if (!open || !day || !dayFilters) return;
    const accountId = getActiveAccountId();
    if (!accountId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const q = buildAnalyticsQuery(accountId, dayFilters);
    void api<{ trades: DrilldownTrade[]; meta: { total: number } }>(`/api/analytics/trades?${q}`)
      .then((res) => {
        if (!cancelled) setTrades(res.trades);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn’t load trades");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, day, dayFilters]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !day) return null;

  const value = dayPerformanceValue(day);
  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "loss").length;
  const summary =
    value == null
      ? "See what happened on this day."
      : value > 0
        ? `Strong day — your ${day.n} trade${day.n === 1 ? "" : "s"} finished ${signed(value)}R.`
        : value < 0
          ? `Difficult day — your ${day.n} trade${day.n === 1 ? "" : "s"} finished ${signed(value)}R.`
          : `Flat day — your ${day.n} trade${day.n === 1 ? "" : "s"} finished around breakeven.`;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="day-inv-title">
      <button type="button" className="scrim" aria-label="Close day investigation" onClick={onClose} />
      <aside className="drawer">
        <header className="head">
          <div>
            <p className="eyebrow">Day investigation</p>
            <h2 id="day-inv-title">{formatDrillDayLabel(day.date)}</h2>
            <p className={`hero ${tone(value)}`}>
              {value != null
                ? day.r != null
                  ? `${signed(value)}R`
                  : money(value, currency)
                : "—"}
              <span className="sub">
                {day.n} trade{day.n === 1 ? "" : "s"}
                {day.record ? ` · ${day.record}` : ""}
              </span>
            </p>
          </div>
          <button type="button" className="close" onClick={onClose}>
            Close
          </button>
        </header>

        <section className="block">
          <h3>What happened?</h3>
          <p className="summary">{summary}</p>
          <dl className="stats">
            <div>
              <dt>Trades</dt>
              <dd>{day.n}</dd>
            </div>
            <div>
              <dt>Wins</dt>
              <dd>{loading ? "…" : wins}</dd>
            </div>
            <div>
              <dt>Losses</dt>
              <dd>{loading ? "…" : losses}</dd>
            </div>
            <div>
              <dt>Net</dt>
              <dd className={tone(day.net_pnl)}>{money(day.net_pnl, currency)}</dd>
            </div>
          </dl>
        </section>

        <section className="block">
          <h3>Trades</h3>
          {loading ? <p className="muted">Loading trades…</p> : null}
          {error ? <p className="err">{error}</p> : null}
          {!loading && !error && trades.length === 0 ? (
            <p className="muted">No trades matched this day.</p>
          ) : null}
          <ul className="list">
            {trades.map((t) => (
              <li key={t.id}>
                <div className="trade">
                  <div className="top">
                    <strong>
                      {t.symbol} {String(t.direction).toUpperCase()}
                    </strong>
                    <span className={tone(t.realized_r ?? t.realized_pnl)}>
                      {t.realized_r != null ? `${signed(t.realized_r)}R` : money(t.realized_pnl, currency)}
                      {t.result ? ` · ${String(t.result).toUpperCase()}` : ""}
                    </span>
                  </div>
                  <p className="meta">
                    {sessionLabel(t.session)}
                    {t.setup_name ? ` · ${t.setup_name}` : ""}
                    {t.trade_timestamp ? ` · ${formatWhen(t.trade_timestamp, timezone)}` : ""}
                  </p>
                  <div className="actions">
                    <Link href={`/trades/${t.id}`}>View trade</Link>
                    <Link href={`/trades/${t.id}`}>Trade anatomy</Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </aside>

      <style jsx>{`
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          justify-content: flex-end;
        }
        .scrim {
          position: absolute;
          inset: 0;
          border: 0;
          background: color-mix(in srgb, #000 45%, transparent);
          cursor: pointer;
        }
        .drawer {
          position: relative;
          width: min(420px, 100%);
          height: 100%;
          overflow: auto;
          background: var(--surface);
          border-left: 1px solid var(--border);
          padding: 18px 16px 28px;
          display: grid;
          gap: 16px;
          align-content: start;
        }
        .head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
        }
        .eyebrow {
          margin: 0 0 4px;
          font-size: 11px;
          font-weight: 650;
          color: var(--accent-text, var(--accent));
          letter-spacing: 0.04em;
        }
        h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .hero {
          margin: 8px 0 0;
          font-size: 1.5rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }
        .hero.pos {
          color: var(--pos);
        }
        .hero.neg {
          color: var(--neg);
        }
        .sub {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted);
          font-family: inherit;
        }
        .close {
          border: 1px solid var(--border);
          background: var(--surface-2);
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 650;
          cursor: pointer;
          font-family: inherit;
          color: var(--text-primary);
        }
        .close:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .block h3 {
          margin: 0 0 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .summary {
          margin: 0 0 10px;
          font-size: 14px;
          line-height: 1.45;
          color: var(--text-secondary);
        }
        .stats {
          margin: 0;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }
        .stats dt {
          margin: 0;
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .stats dd {
          margin: 2px 0 0;
          font-size: 13px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .stats dd.pos {
          color: var(--pos);
        }
        .stats dd.neg {
          color: var(--neg);
        }
        .muted {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
        }
        .err {
          margin: 0;
          font-size: 13px;
          color: var(--neg);
        }
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .trade {
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 10px 12px;
          display: grid;
          gap: 6px;
          background: var(--surface-2);
        }
        .top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 13px;
        }
        .top .pos {
          color: var(--pos);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .top .neg {
          color: var(--neg);
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .meta {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .actions :global(a) {
          font-size: 12px;
          font-weight: 650;
          color: var(--accent-text, var(--accent));
          text-decoration: none;
        }
        .actions :global(a:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        @media (max-width: 520px) {
          .drawer {
            width: 100%;
          }
          .stats {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
