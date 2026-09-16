"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Finding } from "@/lib/intelligence";

type FindingDetailContextValue = {
  finding: Finding | null;
  openFinding: (finding: Finding) => void;
  closeFinding: () => void;
};

const FindingDetailContext = createContext<FindingDetailContextValue | null>(null);

export function FindingDetailProvider({ children }: { children: ReactNode }) {
  const [finding, setFinding] = useState<Finding | null>(null);

  const openFinding = useCallback((next: Finding) => setFinding(next), []);
  const closeFinding = useCallback(() => setFinding(null), []);

  const value = useMemo(
    () => ({ finding, openFinding, closeFinding }),
    [finding, openFinding, closeFinding],
  );

  return <FindingDetailContext.Provider value={value}>{children}</FindingDetailContext.Provider>;
}

export function useFindingDetail(): FindingDetailContextValue {
  const ctx = useContext(FindingDetailContext);
  if (!ctx) {
    throw new Error("useFindingDetail must be used within FindingDetailProvider");
  }
  return ctx;
}

export function useOptionalFindingDetail(): FindingDetailContextValue | null {
  return useContext(FindingDetailContext);
}
