"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
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
  RollingPanel,
  StreakPanel,
} from "@/components/quant-lab/QuantLabPanels";
import { AnalyticsDrilldownProvider } from "@/components/analytics/AnalyticsDrilldownContext";
import { DrilldownFilterBar } from "@/components/analytics/primitives/DrilldownFilterBar";
import { Alert } from "@/components/ui";

const RobustnessLab = dynamic(
  () => import("@/components/quant-lab/QuantLabPanels").then((m) => m.RobustnessLab),
  { loading: () => <p className="muted">Loading robustness studies…</p> },
);
const SimulationLab = dynamic(
  () => import("@/components/quant-lab/SimulationLab").then((m) => m.SimulationLab),
  { loading: () => <p className="muted">Loading simulation lab…</p> },
);
const BehaviorResearchLab = dynamic(
  () => import("@/components/quant-lab/BehaviorResearchLab").then((m) => m.BehaviorResearchLab),
  { loading: () => <p className="muted">Loading behaviour research…</p> },
);
const ResearchIntelligenceLab = dynamic(
  () => import("@/components/quant-lab/ResearchIntelligenceLab").then((m) => m.ResearchIntelligenceLab),
  { loading: () => <p className="muted">Loading research intelligence…</p> },
);

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
      <header className="ql-head">
        <div>
          <h1>Quant Lab</h1>
          <p className="lede muted">Advanced analysis, better decisions — statistical research on your journal.</p>
        </div>
      </header>

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

      <nav className="tab-nav" aria-label="Quant Lab sections" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {!accountId && <Alert kind="info">Select an account to load Quant Lab.</Alert>}
      {error && <Alert kind="danger">{error}</Alert>}
      {loading && !data && <p className="muted" role="status">Loading…</p>}

      {accountId && data && (
        <AnalyticsDrilldownProvider
          accountId={accountId}
          currency={dash?.account.currency ?? "USD"}
          filters={applied}
          onFiltersChange={setApplied}
        >
          {dash && <DrilldownFilterBar filters={applied} data={dash} onChange={setApplied} />}
          <DataQualityStrip dq={data.overview.data_quality} meta={data.meta} />
          <div className="tab-panel" role="tabpanel">
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
                <DrawdownPanel data={data} currency={dash?.account.currency ?? "USD"} />
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
          </div>
        </AnalyticsDrilldownProvider>
      )}

      <style jsx>{`
        .quant-lab {
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: hidden;
        }
        .ql-head {
          margin-bottom: 8px;
        }
        .lede {
          margin: 0;
          font-size: 13px;
          max-width: 56ch;
        }
        .tab-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin: 16px 0;
          padding: 4px;
          border-radius: 999px;
          background: var(--surface-2);
          border: 1px solid var(--border);
          width: fit-content;
          max-width: 100%;
        }
        .tab-nav button {
          border: none;
          background: transparent;
          padding: 7px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          color: var(--text-muted);
          min-height: 36px;
        }
        .tab-nav button.active {
          background: var(--research-soft);
          color: var(--research);
        }
        .tab-panel {
          min-width: 0;
          max-width: 100%;
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
        @media (max-width: 900px) {
          .two-col {
            grid-template-columns: 1fr;
          }
          .tab-nav {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
