"use client";

import { ChartCard } from "@/components/trader/ChartCard";
import { MetricCard } from "@/components/trader/MetricCard";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { jumpCalendarToDay } from "@/components/analytics/calendar/PerformanceCalendar";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { formatR, formatSampleSize } from "@/lib/visualization";
import { money } from "@/lib/format";

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  if (!m || !d) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}`;
}

/** Compact temporal snapshot — best/worst day, weekday, trading-day mix. */
export function CalendarAnswerStrip({ data }: { data: AnalyticsDashboard }) {
  const t = data.lab?.temporal;
  const currency = data.account.currency;
  const drill = useOptionalAnalyticsDrilldown();

  if (!t) {
    return (
      <ChartCard title="Performance snapshot">
        <p className="empty">Close trades to see when you performed best and worst.</p>
        <style jsx>{`
          .empty {
            margin: 0;
            font-size: 13px;
            color: var(--text-muted);
          }
        `}</style>
      </ChartCard>
    );
  }

  const days = t.calendar.days.filter((d) => d.n > 0);
  const byR = [...days].sort(
    (a, b) => Number(b.r ?? Number(b.net_pnl)) - Number(a.r ?? Number(a.net_pnl)),
  );
  const bestDay = byR[0];
  const worstDay = byR.length > 1 ? byR[byR.length - 1] : null;
  const worstDistinct = worstDay && bestDay && worstDay.date !== bestDay.date ? worstDay : null;

  const weekday = [...t.weekday]
    .filter((w) => w.n > 0)
    .sort((a, b) => {
      const ae = Number(a.average_r ?? a.expectancy_r ?? a.net_pnl ?? -999);
      const be = Number(b.average_r ?? b.expectancy_r ?? b.net_pnl ?? -999);
      return be - ae;
    });
  const bestWd = weekday[0];

  const profitable = days.filter((d) => {
    const v = d.r != null ? Number(d.r) : Number(d.net_pnl);
    return v > 0;
  }).length;
  const losing = days.filter((d) => {
    const v = d.r != null ? Number(d.r) : Number(d.net_pnl);
    return v < 0;
  }).length;

  const totalTrades = days.reduce((s, d) => s + d.n, 0);
  const early = totalTrades > 0 && totalTrades < 10;

  function openDay(date: string) {
    // Calendar listens and applies filter + opens drawer with human labels.
    jumpCalendarToDay(date);
  }

  return (
    <ChartCard title="Performance snapshot">
      <div className="grid">
        <MetricCard
          label="Best day"
          value={bestDay ? shortDate(bestDay.date) : "—"}
          hint={
            bestDay
              ? bestDay.r != null
                ? `${formatR(Number(bestDay.r))} · ${formatSampleSize(bestDay.n)}`
                : `${money(bestDay.net_pnl, currency)} · ${formatSampleSize(bestDay.n)}`
              : undefined
          }
          tone="pos"
          onClick={bestDay && drill ? () => openDay(bestDay.date) : undefined}
        />
        <MetricCard
          label="Toughest day"
          value={worstDistinct ? shortDate(worstDistinct.date) : "—"}
          hint={
            worstDistinct
              ? worstDistinct.r != null
                ? `${formatR(Number(worstDistinct.r))} · ${formatSampleSize(worstDistinct.n)}`
                : `${money(worstDistinct.net_pnl, currency)} · ${formatSampleSize(worstDistinct.n)}`
              : undefined
          }
          tone="neg"
          onClick={worstDistinct && drill ? () => openDay(worstDistinct.date) : undefined}
        />
        <MetricCard
          label="Best weekday"
          value={bestWd?.key ?? "—"}
          hint={
            bestWd
              ? bestWd.average_r != null || bestWd.expectancy_r != null
                ? `${formatR(Number(bestWd.average_r ?? bestWd.expectancy_r))} avg · ${formatSampleSize(bestWd.n)}`
                : `${money(bestWd.net_pnl, currency)} · ${formatSampleSize(bestWd.n)}`
              : undefined
          }
        />
        <MetricCard
          label="Trading days"
          value={String(days.length)}
          hint={days.length ? `${profitable} profitable · ${losing} losing` : undefined}
        />
      </div>
      {early ? (
        <p className="early" role="note">
          Still early — {formatSampleSize(totalTrades)} across {days.length} trading day
          {days.length === 1 ? "" : "s"}. More history will make time patterns clearer.
        </p>
      ) : null}
      {drill && (bestDay || worstDistinct) ? (
        <p className="hint">Click a day metric to jump to that date and open trades.</p>
      ) : null}
      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
        }
        .early,
        .hint {
          margin: 10px 0 0;
          font-size: 12px;
          line-height: 1.4;
          color: var(--text-muted);
          max-width: 62ch;
        }
        .hint {
          margin-top: 6px;
        }
      `}</style>
    </ChartCard>
  );
}
