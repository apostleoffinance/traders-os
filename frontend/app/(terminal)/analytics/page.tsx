"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, getActiveAccountId } from "@/lib/api";
import { useAiStatus } from "@/lib/ai";
import { useGlobalFilters } from "@/lib/filters";
import { Alert } from "@/components/ui";
import { IntelligenceRunner } from "@/components/IntelligenceRunner";
import {
  EMPTY_FILTERS,
  buildAnalyticsQuery,
  filtersWithGlobalPeriod,
  type AnalyticsDashboard,
  type FilterState,
} from "@/lib/analytics";
import { AnalyticsFilters } from "@/components/analytics/Filters";
import { AnalyticsOverview } from "@/components/analytics/Overview";
import { EquityDrawdown } from "@/components/analytics/EquityDrawdown";
import { EdgeExplorer } from "@/components/analytics/EdgeExplorer";
import { BehaviourLab } from "@/components/analytics/BehaviourLab";
import { MetricDrilldown } from "@/components/analytics/MetricDrilldown";
import {
  CalendarHeat,
  Distribution,
  MonthlyRolling,
  RiskAndObservations,
  Scatters,
  SessionSetupPsych,
  StreaksConsistency,
} from "@/components/analytics/Sections";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "performance", label: "Performance" },
  { id: "edge", label: "Edge Explorer" },
  { id: "behaviour", label: "Behaviour" },
  { id: "execution", label: "Execution" },
  { id: "risk", label: "Risk" },
  { id: "calendar", label: "Calendar" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading analytics…</p>}>
      <AnalyticsLab />
    </Suspense>
  );
}

function AnalyticsLab() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabId) || "overview";
  const [tab, setTab] = useState<TabId>(TABS.some((t) => t.id === initialTab) ? initialTab : "overview");
  const [accountId, setAccountId] = useState<string | null>(null);
  const { filters: globalFilters } = useGlobalFilters();
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(filtersWithGlobalPeriod(globalFilters.period));
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drillMetric, setDrillMetric] = useState<"win_rate" | "expectancy_r" | "profit_factor" | "average_r" | null>(null);
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
    const next = filtersWithGlobalPeriod(globalFilters.period, applied);
    setApplied((prev) => (prev.preset === next.preset ? prev : { ...prev, preset: next.preset }));
  }, [globalFilters.period]);

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

  const tabContent = useMemo(() => {
    if (!data || !accountId) return null;
    switch (tab) {
      case "overview":
        return (
          <>
            <AnalyticsOverview data={data} onMetricClick={setDrillMetric} />
            <EquityDrawdown data={data} />
            <SessionSetupPsych data={data} />
          </>
        );
      case "performance":
        return (
          <>
            <AnalyticsOverview data={data} onMetricClick={setDrillMetric} />
            <Distribution data={data} />
            <MonthlyRolling data={data} />
            <StreaksConsistency data={data} />
          </>
        );
      case "edge":
        return <EdgeExplorer accountId={accountId} data={data} filters={applied} />;
      case "behaviour":
        return <BehaviourLab data={data} />;
      case "execution":
        return (
          <>
            <Scatters data={data} />
            <Distribution data={data} />
          </>
        );
      case "risk":
        return <RiskAndObservations data={data} />;
      case "calendar":
        return <CalendarHeat data={data} />;
      default:
        return null;
    }
  }, [tab, data, accountId, applied]);

  if (!accountId) {
    return (
      <div>
        <p className="page-kicker">Intelligence</p>
        <h1>Analytics Lab</h1>
        <Alert kind="info">
          Select an account to view analytics. <Link href="/accounts">Open accounts</Link>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <p className="page-kicker">Intelligence</p>
      <h1>Analytics Lab</h1>
      <p className="muted">
        Interactive performance, edge discovery, and behaviour. Period syncs with the top bar — refine filters below.
      </p>

      <nav className="tabs" aria-label="Analytics sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <AnalyticsFilters
        draft={draft}
        setDraft={setDraft}
        data={data}
        onApply={() => setApplied({ ...draft })}
        onReset={() => {
          const reset = filtersWithGlobalPeriod(globalFilters.period);
          setDraft(reset);
          setApplied(reset);
        }}
      />
      {error && <Alert kind="danger">{error}</Alert>}
      {!data && <p className="muted">Loading…</p>}
      {data && <div className="stack">{tabContent}</div>}

      {tab === "overview" && data && (
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
      )}

      {data && (
        <MetricDrilldown
          open={drillMetric !== null}
          metric={drillMetric}
          data={data}
          onClose={() => setDrillMetric(null)}
        />
      )}

      <style jsx>{`
        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin: 14px 0 12px;
        }
        .tabs button {
          border: 1px solid var(--line);
          background: var(--surface);
          color: var(--text-secondary);
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .tabs button.active {
          border-color: var(--accent);
          color: var(--accent);
          background: color-mix(in srgb, var(--accent) 10%, var(--surface));
        }
        .stack {
          display: grid;
          gap: 14px;
        }
        .ai {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-top: 16px;
        }
        @media (max-width: 900px) {
          .ai {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
