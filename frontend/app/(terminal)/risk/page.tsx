"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getActiveAccountId } from "@/lib/api";
import type { RiskCommand } from "@/lib/risk-command";
import { RiskCommandView } from "@/components/risk-command/RiskCommandView";

export default function RiskPage() {
  const [data, setData] = useState<RiskCommand | null>(null);

  const load = useCallback(async () => {
    const id = getActiveAccountId();
    if (!id) return;
    setData(await api<RiskCommand>(`/api/risk/command?account_id=${id}`));
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener("traderos-account", load);
    return () => window.removeEventListener("traderos-account", load);
  }, [load]);

  if (!data) return <p className="muted">Select an account to view Risk Command.</p>;

  return <RiskCommandView data={data} />;
}
