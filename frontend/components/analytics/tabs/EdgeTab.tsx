"use client";

import { DisclosureLayer } from "@/components/analytics/primitives/DisclosureLayer";
import { EdgeLabSections } from "@/components/analytics/EdgeLabSections";
import { EdgeExplorer } from "@/components/analytics/EdgeExplorer";
import { ComparisonLab } from "@/components/analytics/ComparisonLab";
import type { AnalyticsDashboard, FilterState } from "@/lib/analytics";

/** Edge: ranks → boards → explorer (no deep-dive accordion). */
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
        <ComparisonLab accountId={accountId} data={data} />
        <EdgeExplorer accountId={accountId} data={data} filters={filters} />
      </DisclosureLayer>
    </>
  );
}
