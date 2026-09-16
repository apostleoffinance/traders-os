"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { AnalyticsDashboard, FilterState } from "@/lib/analytics";
import { buildCalendarViewModel } from "@/lib/analytics/calendarViewModel";
import { PerformanceSnapshot } from "@/components/analytics/calendar/PerformanceSnapshot";
import { PerformanceCalendar, jumpCalendarToDay } from "@/components/analytics/calendar/PerformanceCalendar";
import { TradingRhythm } from "@/components/analytics/calendar/TradingRhythm";
import { MonthlyPerformanceMatrix } from "@/components/analytics/calendar/MonthlyPerformanceMatrix";

/**
 * Temporal trading investigation workspace.
 * Hierarchy: Snapshot → Calendar → Rhythm → Monthly
 */
export function CalendarTab({
  data,
  filters,
}: {
  data: AnalyticsDashboard;
  filters: FilterState;
}) {
  const model = useMemo(() => buildCalendarViewModel(data), [data]);
  const tradeCount = data.overview.n_trades;

  if (tradeCount <= 0) {
    return (
      <section className="empty-wrap" aria-labelledby="cal-empty-title">
        <header className="intro">
          <h2 className="title">Calendar</h2>
          <p className="lede">See when your trading works — and when it doesn&apos;t.</p>
        </header>
        <div className="empty">
          <h3 id="cal-empty-title">Your trading calendar starts here</h3>
          <p>
            Connect an account or record your first trade to start seeing your performance by day,
            session and month.
          </p>
          <div className="actions">
            <Link href="/trades/new" className="btn primary">
              New trade
            </Link>
            <Link href="/accounts" className="btn">
              Connect account
            </Link>
          </div>
        </div>
        <style jsx>{emptyStyles}</style>
      </section>
    );
  }

  if (!model || model.tradingDays === 0) {
    return (
      <section className="empty-wrap" aria-labelledby="cal-filter-empty">
        <header className="intro">
          <h2 className="title">Calendar</h2>
          <p className="lede">See when your trading works — and when it doesn&apos;t.</p>
        </header>
        <div className="empty">
          <h3 id="cal-filter-empty">No trading days in this filter</h3>
          <p>Try widening the period or clearing instrument filters to see your calendar.</p>
        </div>
        <style jsx>{emptyStyles}</style>
      </section>
    );
  }

  return (
    <div className="workspace">
      <header className="intro">
        <h2 className="title">Calendar</h2>
        <p className="lede">See when your trading works — and when it doesn&apos;t.</p>
        <p className="support">Your trading performance across days, weeks and months.</p>
      </header>

      <PerformanceSnapshot
        model={model}
        currency={data.account.currency}
        onOpenDay={(date) => jumpCalendarToDay(date)}
      />

      <PerformanceCalendar data={data} filters={filters} />

      <TradingRhythm
        weekday={model.weekdayRhythm}
        session={model.sessionRhythm}
        currency={data.account.currency}
        earlyNote={model.earlyNote}
      />

      <MonthlyPerformanceMatrix model={model} currency={data.account.currency} />

      <style jsx>{`
        .workspace {
          display: grid;
          gap: 16px;
          align-content: start;
        }
        .intro {
          display: grid;
          gap: 2px;
          max-width: 520px;
        }
        .title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text-primary);
          text-transform: none;
        }
        .lede {
          margin: 0;
          font-size: 14px;
          font-weight: 550;
          color: var(--text-primary);
        }
        .support {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );
}

const emptyStyles = `
  .empty-wrap {
    display: grid;
    gap: 14px;
  }
  .intro {
    display: grid;
    gap: 2px;
  }
  .title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .lede {
    margin: 0;
    font-size: 14px;
    color: var(--text-muted);
  }
  .empty {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    padding: 22px 20px;
    display: grid;
    gap: 10px;
    max-width: 480px;
  }
  h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 650;
  }
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text-secondary);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 4px;
  }
  .empty-wrap :global(.btn) {
    display: inline-flex;
    align-items: center;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 650;
    text-decoration: none;
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-primary);
  }
  .empty-wrap :global(.btn.primary) {
    background: var(--accent);
    border-color: transparent;
    color: var(--accent-contrast);
  }
`;
