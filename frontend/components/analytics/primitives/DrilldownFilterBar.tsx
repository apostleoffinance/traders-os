"use client";

import { FilterChips } from "@/components/analytics/primitives/FilterChips";
import { useAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { FilterState, AnalyticsDashboard } from "@/lib/analytics";

export function DrilldownFilterBar({
  filters,
  data,
  onChange,
  excludePeriod = false,
}: {
  filters: FilterState;
  data: AnalyticsDashboard;
  onChange: (f: FilterState) => void;
  excludePeriod?: boolean;
}) {
  const drill = useAnalyticsDrilldown();
  return (
    <FilterChips
      filters={filters}
      setupName={(id) => data.filters.options?.setups.find((s) => s.id === id)?.name ?? id}
      onChange={onChange}
      onViewTrades={() => drill.openTrades("Filtered trades")}
      excludePeriod={excludePeriod}
    />
  );
}
