"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, getActiveAccountId } from "@/lib/api";
import { useGlobalFilters } from "@/lib/filters";
import { AnalyticsFilters } from "@/components/analytics/Filters";
import {
  EMPTY_FILTERS,
  buildAnalyticsQuery,
  filtersWithGlobalPeriod,
  type AnalyticsDashboard,
  type FilterState,
} from "@/lib/analytics";
import type { QuantLabPayload } from "@/lib/quant";
import {
  DataQualityStrip,
  DrawdownPanel,
  ExpectancyEnginePanel,
  QuantOverviewPanel,
  RobustnessLab,
  RollingPanel,
  StreakPanel,
} from "@/components/quant-lab/QuantLabPanels";
import { SimulationLab } from "@/components/quant-lab/SimulationLab";
import { BehaviorResearchLab } from "@/components/quant-lab/BehaviorResearchLab";
import { ResearchIntelligenceLab } from "@/components/quant-lab/ResearchIntelligenceLab";
import { AnalyticsDrilldownProvider } from "@/components/analytics/AnalyticsDrilldownContext";
import { DrilldownFilterBar } from "@/components/analytics/primitives/DrilldownFilterBar";
import { Alert } from "@/components/ui";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "edge", label: "Edge" },
  { id: "drawdown", label: "Drawdown" },
  { id: "simulation", label: "Simulation" },
  { id: "robustness", label: "Robustness" },
  { id: "research", label: "Research" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function QuantLabPage() {
  return (
    <Suspense fallback={<p className="muted">Loading Quant Lab…</p>}>
      <QuantLab />
    </Suspense>
  );
}

function QuantLab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as TabId) || "overview";
  const [accountId, setAccountId] = useState<string | null>(null);
  const { filters: globalFilters } = useGlobalFilters();
  const [draft, setDraft] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(filtersWithGlobalPeriod(globalFilters.period));
  const [dash, setDash] = useState<AnalyticsDashboard | null>(null);
  const [data, setData] = useState<QuantLabPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = filtersWithGlobalPeriod(globalFilters.period, applied);
    setApplied((prev) => (prev.preset === next.preset ? prev : { ...prev, preset: next.preset }));
  }, [globalFilters.period]);

  const load = useCallback(async () => {
    const id = getActiveAccountId();
    setAccountId(id);
    if (!id) {
      setData(null);
      setDash(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const q = buildAnalyticsQuery(id, applied);
      const [quantRes, dashRes] = await Promise.all([
        api<QuantLabPayload>(`/api/quant-lab?${q}`),
        api<AnalyticsDashboard>(`/api/analytics/dashboard?${q}`),
      ]);
      setData(quantRes);
      setDash(dashRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load Quant Lab");
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    void load();
    const onAccount = () => void load();
    window.addEventListener("traderos-account", onAccount);
    return () => window.removeEventListener("traderos-account", onAccount);
  }, [load]);

  function setTab(next: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/quant-lab?${params.toString()}`);
  }

  return (
    <div className="quant-lab">
      <p className="page-kicker">Insights</p>
      <div className="head-row">
        <div>
          <h1>Quant Lab</h1>
          <p className="muted intro">Research your trading edge — observed performance, statistical confidence, and simulated scenarios.</p>
        </div>
      </div>

      {accountId && (
        <AnalyticsFilters
          draft={draft}
          setDraft={setDraft}
          data={dash}
          onApply={() => setApplied(filtersWithGlobalPeriod(globalFilters.period, draft))}
          onReset={() => {
            const reset = filtersWithGlobalPeriod(globalFilters.period);
            setDraft(reset);
            setApplied(reset);
          }}
        />
      )}

      <nav className="tab-nav" aria-label="Quant Lab sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {!accountId && <Alert kind="info">Select an account to load Quant Lab.</Alert>}
      {error && <Alert kind="danger">{error}</Alert>}
      {loading && !data && <p className="muted">Computing research metrics…</p>}

      {accountId && data && (
        <AnalyticsDrilldownProvider
          accountId={accountId}
          currency={dash?.account.currency ?? "USD"}
          filters={applied}
          onFiltersChange={setApplied}
        >
          {dash && <DrilldownFilterBar filters={applied} data={dash} onChange={setApplied} />}
          <DataQualityStrip dq={data.overview.data_quality} meta={data.meta} />
          {tab === "overview" && (
            <div className="grid-stack">
              <QuantOverviewPanel data={data} />
              <RollingPanel data={data} />
              <div className="two-col">
                <ExpectancyEnginePanel data={data} />
                <StreakPanel data={data} />
              </div>
            </div>
          )}
          {tab === "edge" && <ExpectancyEnginePanel data={data} />}
          {tab === "drawdown" && (
            <div className="grid-stack">
              <DrawdownPanel data={data} />
              <StreakPanel data={data} />
            </div>
          )}
          {tab === "robustness" && <RobustnessLab data={data} />}
          {tab === "simulation" && (
            <SimulationLab
              accountId={accountId}
              filters={applied}
              data={data}
              startingBalance={data.meta.starting_balance ?? "10000"}
            />
          )}
          {tab === "research" && (
            <>
              <ResearchIntelligenceLab accountId={accountId} data={data} />
              <BehaviorResearchLab accountId={accountId} filters={applied} data={data} />
            </>
          )}
          <p className="disclaimer muted">{data.disclaimer}</p>
        </AnalyticsDrilldownProvider>
      )}

      <style jsx>{`
        .head-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 8px;
        }
        .intro {
          max-width: 640px;
        }
        .tab-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 20px 0;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }
        .tab-nav button {
          border: none;
          background: transparent;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          color: var(--muted);
        }
        .tab-nav button.active {
          background: var(--surface-2);
          color: var(--text);
          font-weight: 600;
        }
        .grid-stack {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          align-items: start;
        }
        .disclaimer {
          margin-top: 24px;
          font-size: 13px;
        }
        @media (max-width: 900px) {
          .two-col {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
