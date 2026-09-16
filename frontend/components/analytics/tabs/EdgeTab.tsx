"use client";

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
      <DisclosureLayer kind="evidence">
        <EdgeLabSections data={data} mode="essential" />
      </DisclosureLayer>
      <DeepDiveSection title="More detail">
        <EdgeLabSections data={data} mode="bubble" />
        <ComparisonLab accountId={accountId} data={data} />
        <EdgeExplorer accountId={accountId} data={data} filters={filters} />
      </DeepDiveSection>
    </>
  );
}
