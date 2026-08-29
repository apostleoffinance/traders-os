"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { TemporalLab } from "@/components/analytics/Phase2Lab";
import type { AnalyticsDashboard } from "@/lib/analytics";

export function CalendarTab({ data }: { data: AnalyticsDashboard }) {
  return (
    <>
      <AnalyticsTabIntro page="calendar" />
      <TemporalLab data={data} />
    </>
  );
}
