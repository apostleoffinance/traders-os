"use client";

import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { TemporalLab } from "@/components/analytics/Phase2Lab";
import { CalendarAnswerStrip } from "@/components/trader";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Calendar: Decision strip → Evidence grid → Deep dive. */
export function CalendarTab({ data }: { data: AnalyticsDashboard }) {
  return (
    <>
      <DisclosureLayer kind="decision">
        <CalendarAnswerStrip data={data} />
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <TemporalLab data={data} variant="essential" />
      </DisclosureLayer>
      <DeepDiveSection title="More detail">
        <TemporalLab data={data} variant="deep" />
      </DeepDiveSection>
    </>
  );
}
