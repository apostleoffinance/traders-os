"use client";

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
      <DisclosureLayer kind="decision">
        <ExecutionAnswerStrip data={data} />
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <ExecutionLab data={data} variant="essential" />
      </DisclosureLayer>
      <DeepDiveSection title="More detail">
        <ExecutionLab data={data} variant="advanced" />
        <Scatters data={data} mode="hold_only" />
      </DeepDiveSection>
    </>
  );
}
