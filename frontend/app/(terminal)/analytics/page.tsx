"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, getActiveAccountId } from "@/lib/api";
import { useAiStatus } from "@/lib/ai";
import { Alert } from "@/components/ui";
import { IntelligenceRunner } from "@/components/IntelligenceRunner";
import {
  EMPTY_FILTERS,
  buildAnalyticsQuery,
  type AnalyticsDashboard,
  type FilterState,
} from "@/lib/analytics";
import { AnalyticsFilters } from "@/components/analytics/Filters";
import { AnalyticsOverview } from "@/components/analytics/Overview";
import { EquityDrawdown } from "@/components/analytics/EquityDrawdown";
import {
  CalendarHeat,
  Distribution,
  MonthlyRolling,
  RiskAndObservations,
  Scatters,
  SessionSetupPsych,
  StreaksConsistency,
} from "@/components/analytics/Sections";

export default function AnalyticsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aiStatus = useAiStatus();

  const load = useCallback(async (id: string, filters: FilterState) => {
    setError(null);
    try {
      setData(await api<AnalyticsDashboard>(`/api/analytics/dashboard?${buildAnalyticsQuery(id, filters)}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    const id = getActiveAccountId();
    setAccountId(id);
    if (id) void load(id, applied);
    const on = () => {
      const next = getActiveAccountId();
      setAccountId(next);
      if (next) void load(next, applied);
    };
    window.addEventListener("traderos-account", on);
    return () => window.removeEventListener("traderos-account", on);
  }, [applied, load]);

  if (!accountId) {
    return (
      <div>
        <p className="page-kicker">Insights</p>
        <h1>Analytics</h1>
        <Alert kind="info">
          Select an account to view analytics. <Link href="/accounts">Open accounts</Link>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <p className="page-kicker">Insights</p>
      <h1>Analytics</h1>
      <p className="muted">Understand your performance, behavior and risk. Numbers come from the engines - not from the charts.</p>
      <AnalyticsFilters
        draft={draft}
        setDraft={setDraft}
        data={data}
        onApply={() => setApplied({ ...draft })}
        onReset={() => {
          setDraft(EMPTY_FILTERS);
          setApplied(EMPTY_FILTERS);
        }}
      />
      {error && <Alert kind="danger">{error}</Alert>}
      {!data && <p className="muted">Loading…</p>}
      {data && (
        <div className="stack">
          <AnalyticsOverview data={data} />
          <EquityDrawdown data={data} />
          <div className="two">
            <SessionSetupPsych data={data} />
          </div>
          <Distribution data={data} />
          <Scatters data={data} />
          <CalendarHeat data={data} />
          <MonthlyRolling data={data} />
          <StreaksConsistency data={data} />
          <RiskAndObservations data={data} />
          <div className="ai">
            <IntelligenceRunner
              path={`/api/ai/accounts/${accountId}/journal-summary`}
              label="Explain my performance"
              hint="Interprets the same deterministic stats. Does not predict the next trade."
              available={aiStatus?.available ?? true}
            />
            <IntelligenceRunner
              path={`/api/ai/accounts/${accountId}/patterns`}
              label="Find behavioral patterns"
              available={aiStatus?.available ?? true}
            />
          </div>
        </div>
      )}
      <style jsx>{`
        .stack {
          display: grid;
          gap: 14px;
        }
        .two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .ai {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 900px) {
          .two,
          .ai {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
