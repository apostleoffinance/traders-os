"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PeriodPreset = "today" | "7d" | "30d" | "90d" | "ytd" | "all";

export type GlobalFilters = {
  period: PeriodPreset;
  symbol: string | null;
  session: string | null;
  setupId: string | null;
};

const STORAGE_KEY = "traderos.global-filters";

const DEFAULT: GlobalFilters = {
  period: "30d",
  symbol: null,
  session: null,
  setupId: null,
};

type Ctx = {
  filters: GlobalFilters;
  setFilters: (patch: Partial<GlobalFilters>) => void;
  resetFilters: () => void;
};

const GlobalFiltersContext = createContext<Ctx | null>(null);

function readStored(): GlobalFilters {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setState] = useState<GlobalFilters>(DEFAULT);

  useEffect(() => {
    setState(readStored());
  }, []);

  const setFilters = useCallback((patch: Partial<GlobalFilters>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setState(DEFAULT);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ filters, setFilters, resetFilters }),
    [filters, setFilters, resetFilters],
  );

  return <GlobalFiltersContext.Provider value={value}>{children}</GlobalFiltersContext.Provider>;
}

export function useGlobalFilters(): Ctx {
  const ctx = useContext(GlobalFiltersContext);
  if (!ctx) throw new Error("useGlobalFilters must be used within GlobalFiltersProvider");
  return ctx;
}

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Today",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  ytd: "Year to date",
  all: "All time",
};
