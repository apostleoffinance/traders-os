"use client";

import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { ExecutionLab } from "@/components/analytics/ExecutionLab";
import { ExecutionAnswerStrip } from "@/components/trader";
import { Scatters } from "@/components/analytics/Sections";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Execution: strip → buckets → scatters (no deep-dive accordion). */
export function ExecutionTab({ data }: { data: AnalyticsDashboard }) {
  return (
    <>
      <DisclosureLayer kind="decision">
        <ExecutionAnswerStrip data={data} />
      </DisclosureLayer>
      <DisclosureLayer kind="evidence">
        <ExecutionLab data={data} variant="essential" />
        <ExecutionLab data={data} variant="advanced" />
        <Scatters data={data} mode="hold_only" />
      </DisclosureLayer>
    </>
  );
}
