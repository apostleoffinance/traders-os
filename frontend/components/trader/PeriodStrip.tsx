"use client";

import { useGlobalFilters, type PeriodPreset } from "@/lib/filters";

const OPTIONS: { id: PeriodPreset; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "ALL" },
];

/** Compact period control wired to global filters. */
export function PeriodStrip({
  includeToday = false,
}: {
  includeToday?: boolean;
}) {
  const { filters, setFilters } = useGlobalFilters();
  const opts = includeToday ? [{ id: "today" as const, label: "Today" }, ...OPTIONS] : OPTIONS;

  return (
    <div className="tos-period" role="group" aria-label="Period">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          className={filters.period === o.id ? "active" : ""}
          onClick={() => setFilters({ period: o.id })}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
