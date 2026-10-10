"use client";

import { AnalyticsFilters, DrilldownFilterBar, LoadingState } from "@/components/trader";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, getActiveAccountId } from "@/lib/api";
import { useAiStatus } from "@/lib/ai";
import { useGlobalFilters, PERIOD_LABELS } from "@/lib/filters";
import { Alert } from "@/components/ui";
import { IntelligenceRunner } from "@/components/IntelligenceRunner";
import {
  EMPTY_FILTERS,
  buildAnalyticsQuery,
  filtersWithGlobalPeriod,
  type AnalyticsDashboard,
  type FilterState,
} from "@/lib/analytics";
import { AnalyticsDrilldownProvider } from "@/components/analytics/AnalyticsDrilldownContext";
import { AnalyticsOverview } from "@/components/analytics/Overview";
import { PerformanceTab } from "@/components/analytics/tabs/PerformanceTab";
import { EdgeTab } from "@/components/analytics/tabs/EdgeTab";
import { BehaviourTab } from "@/components/analytics/tabs/BehaviourTab";
import { ExecutionTab } from "@/components/analytics/tabs/ExecutionTab";
import { RiskTab } from "@/components/analytics/tabs/RiskTab";
import { CalendarTab } from "@/components/analytics/tabs/CalendarTab";
import { MetricDrilldown } from "@/components/analytics/MetricDrilldown";
import { ResearchContextNotice } from "@/components/analytics/ResearchContextNotice";

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
    <Suspense fallback={<LoadingState label="Loading analytics…" />}>
      <AnalyticsLab />
    </Suspense>
  );
}

function AnalyticsLab() {
  const searchParams = useSearchParams();
  const urlTab = (searchParams.get("tab") as TabId) || "overview";
  const [tab, setTab] = useState<TabId>(TABS.some((t) => t.id === urlTab) ? urlTab : "overview");
  const [accountId, setAccountId] = useState<string | null>(null);
  const { filters: globalFilters, setFilters } = useGlobalFilters();
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(filtersWithGlobalPeriod(globalFilters.period));
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const loadRequestRef = useRef(0);
  const [drillMetric, setDrillMetric] = useState<"win_rate" | "expectancy_r" | "profit_factor" | "average_r" | null>(null);
  const aiStatus = useAiStatus();

  useEffect(() => {
    if (TABS.some((t) => t.id === urlTab)) setTab(urlTab);
  }, [urlTab]);

  const load = useCallback(async (id: string, filters: FilterState) => {
    const requestId = ++loadRequestRef.current;
    setError(null);
    try {
      const result = await api<AnalyticsDashboard>(`/api/analytics/dashboard?${buildAnalyticsQuery(id, filters)}`);
      if (requestId !== loadRequestRef.current) return;
      setData(result);
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      setError(err instanceof Error ? err.message : "Could not load analytics.");
      setData(null);
    }
  }, []);

  useEffect(() => {
    const next = filtersWithGlobalPeriod(globalFilters.period, applied);
    setApplied((prev) => (prev.preset === next.preset ? prev : { ...prev, preset: next.preset }));
  }, [globalFilters.period]);

  useEffect(() => {
    const symbol = globalFilters.symbol ?? "";
    const session = globalFilters.session ?? "";
    const setup_id = globalFilters.setupId ?? "";
    setApplied((prev) => {
      if (prev.symbol === symbol && prev.session === session && prev.setup_id === setup_id) return prev;
      return { ...prev, symbol, session, setup_id };
    });
    setDraft((prev) => {
      if (prev.symbol === symbol && prev.session === session && prev.setup_id === setup_id) return prev;
      return { ...prev, symbol, session, setup_id };
    });
  }, [globalFilters.symbol, globalFilters.session, globalFilters.setupId]);

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
  }, [applied, load, retryVersion]);

  const tabContent = useMemo(() => {
    if (!data || !accountId) return null;
    switch (tab) {
      case "overview":
        return <AnalyticsOverview data={data} onMetricClick={setDrillMetric} onTabChange={setTab} />;
      case "performance":
        return <PerformanceTab data={data} onMetricClick={setDrillMetric} />;
      case "edge":
        return <EdgeTab accountId={accountId} data={data} filters={applied} />;
      case "behaviour":
        return <BehaviourTab data={data} />;
      case "execution":
        return <ExecutionTab data={data} />;
      case "risk":
        return <RiskTab data={data} />;
      case "calendar":
        return <CalendarTab data={data} filters={applied} />;
      default:
        return null;
    }
  }, [tab, data, accountId, applied]);

  if (!accountId) {
    return (
      <div>
        <h1>Analytics</h1>
        <Alert kind="info">
          Select an account to view analytics. <Link href="/accounts">Open accounts</Link>
        </Alert>
      </div>
    );
  }

  return (
    <AnalyticsDrilldownProvider
      accountId={accountId}
      currency={data?.account.currency ?? "USD"}
      timezone={data?.lab?.temporal?.calendar?.timezone ?? data?.lab?.metadata?.timezone}
      filters={applied}
      onFiltersChange={setApplied}
    >
    <div>
      <header className="page-head">
        <div>
          <p className="ws-kicker">05 · Analytics</p>
          <h1>Analytics</h1>
          <p className="lede muted">
            What happened, where your results are, and what to investigate next.
            {data
              ? ` ${PERIOD_LABELS[globalFilters.period] ?? applied.preset} · ${data.overview.n_trades} trade${
                  data.overview.n_trades === 1 ? "" : "s"
                }.${
                  data.overview.n_trades < 10
                    ? " Patterns are still forming. R is shown when a trade has a stop."
                    : ""
                }`
              : ""}
          </p>
        </div>
      </header>

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
        onApply={() => {
          setApplied({ ...draft });
          setFilters({
            symbol: draft.symbol || null,
            session: draft.session || null,
            setupId: draft.setup_id || null,
          });
        }}
        onReset={() => {
          const reset = filtersWithGlobalPeriod(globalFilters.period);
          setDraft(reset);
          setApplied(reset);
        }}
      />
      {data && <DrilldownFilterBar filters={applied} data={data} onChange={setApplied} />}
      {data && <ResearchContextNotice context={data.research_context} />}
      {error && (
        <div className="analytics-error" role="alert">
          <Alert kind="danger">{error}</Alert>
          <button type="button" className="btn ghost" onClick={() => setRetryVersion((version) => version + 1)}>
            Retry analytics
          </button>
        </div>
      )}
      {!data && !error && <LoadingState label="Loading analytics…" />}
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
        .analytics-error {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .page-head {
          margin-bottom: 4px;
        }
        .lede {
          margin: 0;
          font-size: 13px;
          max-width: 56ch;
        }
        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin: 14px 0 12px;
          padding: 4px;
          border-radius: 999px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          width: fit-content;
          max-width: 100%;
        }
        .tabs button {
          border: 0;
          background: transparent;
          color: var(--text-muted);
          padding: 7px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .tabs button.active {
          color: var(--accent);
          background: var(--accent-soft);
        }
        .stack {
          display: grid;
          gap: 10px;
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
          .tabs {
            width: 100%;
          }
        }
      `}</style>
    </div>
    </AnalyticsDrilldownProvider>
  );
}
