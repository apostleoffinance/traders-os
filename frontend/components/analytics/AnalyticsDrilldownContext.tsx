"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { FilterState } from "@/lib/analytics";
import { mergeFilterPatch } from "@/lib/analytics-drilldown";
import { TradeDrilldownDrawer } from "@/components/analytics/primitives/TradeDrilldownDrawer";

type DrilldownContextValue = {
  applyPatch: (patch: Partial<FilterState>, label?: string) => void;
  openTrades: (title?: string) => void;
};

const DrilldownContext = createContext<DrilldownContextValue | null>(null);

export function useAnalyticsDrilldown() {
  const ctx = useContext(DrilldownContext);
  if (!ctx) {
    throw new Error("useAnalyticsDrilldown must be used within AnalyticsDrilldownProvider");
  }
  return ctx;
}

export function useOptionalAnalyticsDrilldown() {
  return useContext(DrilldownContext);
}

export function AnalyticsDrilldownProvider({
  accountId,
  currency,
  timezone,
  filters,
  onFiltersChange,
  children,
}: {
  accountId: string | null;
  currency: string;
  timezone?: string;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("Trades");

  const applyPatch = useCallback(
    (patch: Partial<FilterState>, label?: string) => {
      onFiltersChange(mergeFilterPatch(filters, patch));
      if (label) setDrawerTitle(label);
    },
    [filters, onFiltersChange],
  );

  const openTrades = useCallback((title = "Trades in selection") => {
    setDrawerTitle(title);
    setDrawerOpen(true);
  }, []);

  const value = useMemo(() => ({ applyPatch, openTrades }), [applyPatch, openTrades]);

  return (
    <DrilldownContext.Provider value={value}>
      {children}
      {accountId && (
        <TradeDrilldownDrawer
          open={drawerOpen}
          title={drawerTitle}
          accountId={accountId}
          filters={filters}
          currency={currency}
          timezone={timezone}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </DrilldownContext.Provider>
  );
}
