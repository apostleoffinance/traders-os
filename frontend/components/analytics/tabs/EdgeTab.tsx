"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { EdgeLabSections } from "@/components/analytics/EdgeLabSections";
import { EdgeExplorer } from "@/components/analytics/EdgeExplorer";
import { ComparisonLab } from "@/components/analytics/ComparisonLab";
import type { AnalyticsDashboard, FilterState } from "@/lib/analytics";

export function EdgeTab({
  accountId,
  data,
  filters,
}: {
  accountId: string;
  data: AnalyticsDashboard;
  filters: FilterState;
}) {
  return (
    <>
      <AnalyticsTabIntro page="edge" />
      <EdgeLabSections data={data} mode="essential" />
      <DeepDiveSection title="Advanced edge tools" description="Instrument scatter map, condition comparison, and symbol × session matrix.">
        <EdgeLabSections data={data} mode="bubble" />
        <ComparisonLab accountId={accountId} data={data} />
        <EdgeExplorer accountId={accountId} data={data} filters={filters} />
      </DeepDiveSection>
    </>
  );
}
