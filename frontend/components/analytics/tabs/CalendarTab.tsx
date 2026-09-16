"use client";

import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { TemporalLab } from "@/components/analytics/Phase2Lab";
import { CalendarAnswerStrip } from "@/components/trader";
import { MonthlyReturnsHeatmap } from "@/components/analytics/calendar/MonthlyReturnsHeatmap";
import { DailyPerformanceBars } from "@/components/analytics/calendar/DailyPerformanceBars";
import { MonthlyBreakdown } from "@/components/analytics/calendar/MonthlyBreakdown";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Performance Calendar — heatmap, daily bars, monthly breakdown. */
export function CalendarTab({ data }: { data: AnalyticsDashboard }) {
  const hasTemporal = Boolean(data.lab?.temporal);

  return (
    <>
      <DisclosureLayer kind="decision">
        <CalendarAnswerStrip data={data} />
      </DisclosureLayer>

      {hasTemporal ? (
        <DisclosureLayer kind="evidence">
          <div className="cal-grid">
            <div className="cal-main">
              <MonthlyReturnsHeatmap data={data} />
              <DailyPerformanceBars data={data} />
            </div>
            <aside className="cal-side">
              <MonthlyBreakdown data={data} />
            </aside>
          </div>
          <style jsx>{`
            .cal-grid {
              display: grid;
              grid-template-columns: minmax(0, 1.7fr) minmax(260px, 0.9fr);
              gap: 14px;
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
        </DisclosureLayer>
      ) : null}

      <DeepDiveSection title="More detail">
        <TemporalLab data={data} variant="deep" />
      </DeepDiveSection>
    </>
  );
}
