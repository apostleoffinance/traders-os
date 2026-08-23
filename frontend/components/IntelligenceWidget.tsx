"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, getActiveAccountId } from "@/lib/api";
import { Panel } from "@/components/ui";
import { num } from "@/lib/format";

type Widget = {
  risk_status: string | null;
  last_20: { n?: number; expectancy_r?: string | null };
  behavior: {
    avg_risk_after_loss: string | null;
    avg_risk_after_win: string | null;
    trades_after_two_plus_losses: number;
    revenge_or_emotional_count: number;
  };
  cached: Record<string, { summary?: string; created_at: string | null }>;
  note: string;
};

export function IntelligenceWidget() {
  const [data, setData] = useState<Widget | null>(null);

  const load = useCallback(async () => {
    const id = getActiveAccountId();
    if (!id) return;
    setData(await api<Widget>(`/api/ai/accounts/${id}/widget`));
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener("traderos-account", load);
    return () => window.removeEventListener("traderos-account", load);
  }, [load]);

  if (!data) return null;
  const cached = Object.values(data.cached)[0];

  return (
    <Panel
      title="Trading intelligence"
      right={
        <Link href="/intelligence" className="muted">
          View analysis
        </Link>
      }
    >
      <p>
        Last {data.last_20.n ?? 0} trades · expectancy{" "}
        <span className="num">{data.last_20.expectancy_r ? `${num(data.last_20.expectancy_r)}R` : "-"}</span>
        {data.risk_status ? ` · risk ${data.risk_status.toUpperCase()}` : ""}
      </p>
      {data.behavior.avg_risk_after_loss && data.behavior.avg_risk_after_win && (
        <p className="muted">
          Average risk after losses ${num(data.behavior.avg_risk_after_loss)} vs after wins $
          {num(data.behavior.avg_risk_after_win)}. Observation only - not a signal.
        </p>
      )}
      {data.behavior.trades_after_two_plus_losses > 0 && (
        <p className="muted">
          {data.behavior.trades_after_two_plus_losses} trade(s) occurred after two or more consecutive losses.
        </p>
      )}
      {cached?.summary && <p>{cached.summary}</p>}
      {!cached?.summary && (
        <p>
          <Link href="/intelligence" style={{ textDecoration: "underline", fontWeight: 600 }}>
            Open Intelligence to run analysis.
          </Link>
        </p>
      )}
    </Panel>
  );
}
