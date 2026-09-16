"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { TemporalLab } from "@/components/analytics/Phase2Lab";
import { CalendarAnswerStrip } from "@/components/trader";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Calendar: Decision strip → Evidence grid → Deep dive. */
export function CalendarTab({ data }: { data: AnalyticsDashboard }) {
  return (
    <>
      <AnalyticsTabIntro page="calendar" />
      <DisclosureLayer kind="decision">
        <CalendarAnswerStrip data={data} />
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <TemporalLab data={data} variant="essential" />
      </DisclosureLayer>
      <DeepDiveSection
        title="Weekday & monthly research"
        description="Day-of-week bars, monthly performance, and period comparison — optional detail."
      >
        <TemporalLab data={data} variant="deep" />
      </DeepDiveSection>
    </>
  );
}
