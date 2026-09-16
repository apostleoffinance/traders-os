"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { ExecutionLab } from "@/components/analytics/ExecutionLab";
import { ExecutionAnswerStrip } from "@/components/trader";
import { Scatters } from "@/components/analytics/Sections";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Execution: Decision strip → Evidence buckets → Deep dive scatters. */
export function ExecutionTab({ data }: { data: AnalyticsDashboard }) {
  return (
    <>
      <AnalyticsTabIntro page="execution" />
      <DisclosureLayer kind="decision">
        <ExecutionAnswerStrip data={data} />
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <ExecutionLab data={data} variant="essential" />
      </DisclosureLayer>
      <DeepDiveSection
        title="Scatter diagnostics"
        description="Size vs outcome, MFE/MAE, risk vs R, and hold time — optional research views."
      >
        <ExecutionLab data={data} variant="advanced" />
        <Scatters data={data} mode="hold_only" />
      </DeepDiveSection>
    </>
  );
}
