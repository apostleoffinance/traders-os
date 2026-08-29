"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { ExecutionLab } from "@/components/analytics/ExecutionLab";
import { Distribution, Scatters } from "@/components/analytics/Sections";
import type { AnalyticsDashboard } from "@/lib/analytics";

export function ExecutionTab({ data }: { data: AnalyticsDashboard }) {
  return (
    <>
      <AnalyticsTabIntro page="execution" />
      <ExecutionLab data={data} variant="essential" />
      <DeepDiveSection title="Scatter diagnostics" description="MFE/MAE, risk vs result, and holding time scatter plots with quadrant guides.">
        <ExecutionLab data={data} variant="advanced" />
        <Scatters data={data} />
        <Distribution data={data} />
      </DeepDiveSection>
    </>
  );
}
