"use client";

import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { TemporalLab } from "@/components/analytics/Phase2Lab";
import { CalendarAnswerStrip } from "@/components/trader";
import { PerformanceCalendar } from "@/components/analytics/calendar/PerformanceCalendar";
import { MonthlyReturnsHeatmap } from "@/components/analytics/calendar/MonthlyReturnsHeatmap";
import { DailyPerformanceBars } from "@/components/analytics/calendar/DailyPerformanceBars";
import { MonthlyBreakdown } from "@/components/analytics/calendar/MonthlyBreakdown";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Temporal intelligence — snapshot + interactive calendar, then monthly context. */
export function CalendarTab({ data }: { data: AnalyticsDashboard }) {
  const hasTemporal = Boolean(data.lab?.temporal);
  const tradeCount = data.overview.n_trades;

  return (
    <>
      <header className="intro">
        <h2 className="title">Calendar</h2>
        <p className="lede">See how your trading performs across time.</p>
      </header>

      <DisclosureLayer kind="decision">
        <CalendarAnswerStrip data={data} />
      </DisclosureLayer>

      {hasTemporal ? (
        <DisclosureLayer kind="evidence">
          <PerformanceCalendar data={data} />
          <div className="cal-grid">
            <div className="cal-main">
              <MonthlyReturnsHeatmap data={data} />
              <DailyPerformanceBars data={data} />
            </div>
            <aside className="cal-side">
              <MonthlyBreakdown data={data} />
            </aside>
          </div>
        </DisclosureLayer>
      ) : tradeCount === 0 ? (
        <p className="empty muted">No closed trades yet — the calendar appears after your first close.</p>
      ) : null}

      <DeepDiveSection title="More detail">
        <TemporalLab data={data} variant="deep" />
      </DeepDiveSection>

      <style jsx>{`
        .intro {
          display: grid;
          gap: 2px;
          margin-bottom: 4px;
        }
        .title {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        .lede {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
        }
        .empty {
          margin: 0;
          font-size: 13px;
        }
        .muted {
          color: var(--text-muted);
        }
        .cal-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(260px, 0.9fr);
          gap: 10px;
          align-items: start;
        }
        .cal-main {
          display: grid;
          gap: 14px;
          min-width: 0;
        }
        .cal-side {
          min-width: 0;
        }
        @media (max-width: 980px) {
          .cal-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
