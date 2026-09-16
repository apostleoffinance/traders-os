"use client";

import { AnalyticsTabIntro } from "@/components/analytics/primitives/AnalyticsTabIntro";
import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { DeepDiveSection } from "@/components/analytics/primitives/DeepDiveSection";
import { EdgeLabSections } from "@/components/analytics/EdgeLabSections";
import { EdgeExplorer } from "@/components/analytics/EdgeExplorer";
import { ComparisonLab } from "@/components/analytics/ComparisonLab";
import type { AnalyticsDashboard, FilterState } from "@/lib/analytics";

/** Edge: Decision ranks → Evidence boards → Deep dive maps. */
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
      <DisclosureLayer kind="evidence">
        <EdgeLabSections data={data} mode="essential" />
      </DisclosureLayer>
      <DeepDiveSection
        title="Advanced edge tools"
        description="Instrument scatter map, day × hour heatmap, condition comparison, and symbol × session matrix."
      >
        <EdgeLabSections data={data} mode="bubble" />
        <ComparisonLab accountId={accountId} data={data} />
        <EdgeExplorer accountId={accountId} data={data} filters={filters} />
      </DeepDiveSection>
    </>
  );
}
