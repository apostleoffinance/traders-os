"use client";

import { describeFilterChips, clearFilterKey } from "@/lib/analytics-drilldown";
import type { FilterState } from "@/lib/analytics";

export function FilterChips({
  filters,
  setupName,
  onChange,
  onViewTrades,
}: {
  filters: FilterState;
  setupName?: (id: string) => string;
  onChange: (next: FilterState) => void;
  onViewTrades?: () => void;
}) {
  const chips = describeFilterChips(filters, setupName);
  if (chips.length === 0) return null;

  return (
    <div className="chips" aria-label="Active analysis filters">
      <span className="label">Drill-down</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="chip"
          onClick={() => onChange(clearFilterKey(filters, chip.key))}
          title="Remove filter"
        >
          {chip.label} ×
        </button>
      ))}
      {onViewTrades && (
        <button type="button" className="view-trades" onClick={onViewTrades}>
          View trades
        </button>
      )}
      <button type="button" className="reset" onClick={() => onChange(clearAllDrilldown(filters))}>
        Reset drill-down
      </button>
      <style jsx>{`
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          padding: 10px 14px;
          margin-bottom: 16px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }
        .label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--muted);
          font-weight: 600;
        }
        .chip,
        .view-trades,
        .reset {
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .view-trades {
          background: var(--accent);
          color: var(--accent-contrast, #fff);
          border-color: var(--accent);
          font-weight: 600;
        }
        .reset {
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}

function clearAllDrilldown(filters: FilterState): FilterState {
  return {
    ...filters,
    symbol: "",
    session: "",
    setup_id: "",
    direction: "",
    timeframe: "",
    psychology: "",
    result: "",
    hour: "",
    date_from: "",
    date_to: "",
    preset: filters.preset === "custom" ? "all" : filters.preset,
  };
}
