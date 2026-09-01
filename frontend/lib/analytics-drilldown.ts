import type { FilterState } from "@/lib/analytics";
import { EMPTY_FILTERS } from "@/lib/analytics";
import { sessionLabel } from "@/lib/format";

export type DrilldownTrade = {
  id: string;
  symbol: string;
  direction: string;
  session: string;
  setup_name: string | null;
  timeframe: string;
  trade_timestamp: string | null;
  realized_pnl: string;
  realized_r: string | null;
  result: string;
};

export type FilterChip = {
  key: keyof FilterState;
  label: string;
};

const FILTER_LABELS: Partial<Record<keyof FilterState, string>> = {
  symbol: "Instrument",
  session: "Session",
  setup_id: "Setup",
  direction: "Direction",
  timeframe: "Timeframe",
  psychology: "Psychology",
  result: "Result",
  hour: "Hour",
  date_from: "From",
  date_to: "To",
  preset: "Period",
};

export function mergeFilterPatch(base: FilterState, patch: Partial<FilterState>): FilterState {
  return { ...base, ...patch };
}

export function describeFilterChips(
  filters: FilterState,
  setupName?: (id: string) => string,
  opts?: { excludePreset?: boolean },
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (!opts?.excludePreset && filters.preset && filters.preset !== "all") {
    chips.push({ key: "preset", label: `Period: ${filters.preset}` });
  }
  if (filters.symbol) chips.push({ key: "symbol", label: `${FILTER_LABELS.symbol}: ${filters.symbol}` });
  if (filters.session) chips.push({ key: "session", label: `${FILTER_LABELS.session}: ${sessionLabel(filters.session)}` });
  if (filters.setup_id) {
    const name = setupName?.(filters.setup_id) ?? filters.setup_id.slice(0, 8);
    chips.push({ key: "setup_id", label: `Setup: ${name}` });
  }
  if (filters.direction) chips.push({ key: "direction", label: `Direction: ${filters.direction}` });
  if (filters.timeframe) chips.push({ key: "timeframe", label: `Timeframe: ${filters.timeframe}` });
  if (filters.psychology) chips.push({ key: "psychology", label: `Psychology: ${filters.psychology}` });
  if (filters.result) chips.push({ key: "result", label: `Result: ${filters.result}` });
  if (filters.hour) chips.push({ key: "hour", label: `${filters.hour}:00` });
  if (filters.preset === "custom" && filters.date_from) {
    chips.push({ key: "date_from", label: `From ${filters.date_from}` });
  }
  if (filters.preset === "custom" && filters.date_to) {
    chips.push({ key: "date_to", label: `To ${filters.date_to}` });
  }
  return chips;
}

/** Clear chart drill-down fields only; leaves period preset unchanged. */
export function clearDrilldownOnly(filters: FilterState): FilterState {
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

export function clearFilterKey(filters: FilterState, key: keyof FilterState): FilterState {
  const next = { ...filters };
  if (key === "preset") {
    next.preset = "all";
    next.date_from = "";
    next.date_to = "";
  } else if (key === "date_from" || key === "date_to") {
    next[key] = "";
    if (!next.date_from && !next.date_to) next.preset = "all";
  } else {
    next[key] = EMPTY_FILTERS[key] as never;
  }
  return next;
}

export function filterForSingleDay(date: string): Partial<FilterState> {
  return { preset: "custom", date_from: date, date_to: date };
}

export function filterForDateRange(dateFrom: string, dateTo: string): Partial<FilterState> {
  const from = dateFrom.slice(0, 10);
  const to = dateTo.slice(0, 10);
  return { preset: "custom", date_from: from, date_to: to };
}
