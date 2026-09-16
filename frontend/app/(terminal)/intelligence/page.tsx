"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, getActiveAccountId } from "@/lib/api";
import { AI_UNAVAILABLE_MESSAGE, useAiStatus } from "@/lib/ai";
import { useGlobalFilters, PERIOD_LABELS, type PeriodPreset } from "@/lib/filters";
import {
  buildAnalyticsQuery,
  filtersWithGlobalPeriod,
  type AnalyticsDashboard,
  type FilterState,
  type IntelligenceLabPayload,
} from "@/lib/analytics";
import {
  buildIntelligenceFindings,
  type IntelligenceFeedResponse,
  type IntelligenceEngineResult,
} from "@/lib/intelligence";
import { PrimaryFinding, PrimaryFindingSkeleton } from "@/components/intelligence/PrimaryFinding";
import { AttentionGrid, AttentionGridSkeleton } from "@/components/intelligence/AttentionGrid";
import { InvestigateNext, InvestigateNextSkeleton } from "@/components/intelligence/InvestigateNext";
import { RecentIntelligence, RecentIntelligenceSkeleton } from "@/components/intelligence/RecentIntelligence";
import { FindingDetailProvider } from "@/components/intelligence/FindingDetailContext";
import { IntelligenceMethodology } from "@/components/intelligence/IntelligenceMethodology";
import {
  IntelligenceEmptyState,
  IntelligenceErrorState,
  IntelligenceNoFindingState,
} from "@/components/intelligence/IntelligenceStates";
import { AnalyticsDrilldownProvider } from "@/components/analytics/AnalyticsDrilldownContext";
import { AnalyticsFilters } from "@/components/analytics/Filters";
import { DrilldownFilterBar } from "@/components/analytics/primitives/DrilldownFilterBar";
import { Alert } from "@/components/ui";

const FindingDetailDrawer = dynamic(
  () => import("@/components/intelligence/FindingDetailDrawer").then((m) => m.FindingDetailDrawer),
  { ssr: false },
);

function periodLabel(preset: string): string {
  return PERIOD_LABELS[preset as PeriodPreset] ?? preset;
}

export default function IntelligencePage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [feed, setFeed] = useState<IntelligenceFeedResponse | null>(null);
  const [intel, setIntel] = useState<IntelligenceLabPayload | null>(null);
  const [dash, setDash] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { filters: globalFilters, ready: filtersReady } = useGlobalFilters();
  const [draft, setDraft] = useState<FilterState>(filtersWithGlobalPeriod(globalFilters.period));
  const [applied, setApplied] = useState<FilterState>(filtersWithGlobalPeriod(globalFilters.period));
  const status = useAiStatus();
  const loadSeq = useRef(0);

  useEffect(() => {
    if (!filtersReady) return;
    const next = filtersWithGlobalPeriod(globalFilters.period, applied);
    setApplied((prev) => (prev.preset === next.preset ? prev : { ...prev, preset: next.preset }));
    setDraft((prev) => (prev.preset === next.preset ? prev : { ...prev, preset: next.preset }));
  }, [filtersReady, globalFilters.period]);

  const load = useCallback(async (filters: FilterState) => {
    const id = getActiveAccountId();
    setAccountId(id);
    if (!id) {
      setFeed(null);
      setIntel(null);
      setDash(null);
      setLoading(false);
      setEnriching(false);
      setError(null);
      return;
    }
    const seq = ++loadSeq.current;
    const q = buildAnalyticsQuery(id, filters);
    setLoading(true);
    setEnriching(true);
    setError(null);
    setFeed(null);
    setIntel(null);

    let gotDash = false;
    try {
      // Dashboard first — Primary/Attention can render without waiting on feed/lab.
      const dashRes = await api<AnalyticsDashboard>(`/api/analytics/dashboard?${q}`);
      if (seq !== loadSeq.current) return;
      gotDash = true;
      setDash(dashRes);
      setLoading(false);

      const [feedRes, intelRes] = await Promise.all([
        api<IntelligenceFeedResponse>(`/api/intelligence/feed?account_id=${id}&preset=${filters.preset}`),
        api<IntelligenceLabPayload>(`/api/analytics/intelligence?${q}`),
      ]);
      if (seq !== loadSeq.current) return;
      setFeed(feedRes);
      setIntel(intelRes);
    } catch {
      if (seq !== loadSeq.current) return;
      if (!gotDash) {
        setFeed(null);
        setIntel(null);
        setDash(null);
        setError("load_failed");
      }
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
        setEnriching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    void load(applied);
    const onAccount = () => void load(applied);
    window.addEventListener("traderos-account", onAccount);
    return () => window.removeEventListener("traderos-account", onAccount);
  }, [applied, filtersReady, load]);

  const activePeriodLabel = periodLabel(applied.preset);
  const currency = dash?.account.currency ?? "USD";

  const engine: IntelligenceEngineResult | null = useMemo(() => {
    if (!dash) return null;
    return buildIntelligenceFindings({
      dashboard: dash,
      feed,
      lab: intel,
      tradeCount: dash.overview.n_trades,
      periodLabel: activePeriodLabel,
    });
  }, [dash, feed, intel, activePeriodLabel]);

  const showSkeletons = accountId && loading && !engine;
  const showCenter = accountId && !error && engine;

  const body = (
    <>
      {status && !status.available && <Alert kind="warn">{status.message ?? AI_UNAVAILABLE_MESSAGE}</Alert>}
      {!accountId && (
        <Alert kind="info">
          Select an account to load intelligence. <Link href="/accounts">Open accounts</Link>
        </Alert>
      )}

      {accountId && error && !engine ? <IntelligenceErrorState onRetry={() => void load(applied)} /> : null}

      {showSkeletons ? (
        <div className="center" aria-busy="true" aria-live="polite">
          <PrimaryFindingSkeleton />
          <AttentionGridSkeleton />
          <InvestigateNextSkeleton />
          <RecentIntelligenceSkeleton />
        </div>
      ) : null}

      {showCenter ? (
        <div className="center" aria-live="polite">
          {engine.maturity === "empty" ? (
            <IntelligenceEmptyState tradeCount={engine.tradeCount} />
          ) : (
            <>
              {engine.maturity === "early" ? (
                <p className="maturity" role="status">
                  Early signals — {engine.tradeCount} completed trades. Observations are available, but
                  evidence is still limited.
                </p>
              ) : engine.notableCount > 0 ? (
                <p className="maturity" role="status">
                  Your trading has {engine.notableCount} notable pattern
                  {engine.notableCount === 1 ? "" : "s"} in {activePeriodLabel}.
                </p>
              ) : null}

              {enriching ? (
                <p className="enrich muted" role="status">
                  Refining feed and lab signals…
                </p>
              ) : null}

              {engine.primary ? (
                <PrimaryFinding
                  finding={engine.primary}
                  early={engine.maturity === "early"}
                  tradeCount={engine.tradeCount}
                />
              ) : (
                <IntelligenceNoFindingState tradeCount={engine.tradeCount} />
              )}

              <AttentionGrid findings={engine.attention} early={engine.maturity === "early"} />
              <InvestigateNext findings={engine.queue} />
              <RecentIntelligence findings={engine.recent} />

              <p className="ai-note muted">
                Open any finding and use <strong>Explain this finding</strong> for optional AI
                interpretation. Numbers stay locked to deterministic evidence.
              </p>

              <IntelligenceMethodology />
            </>
          )}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="page">
      <a href="#intel-main" className="skip">
        Skip to findings
      </a>

      <header className="hero">
        <h1>Intelligence</h1>
        <p className="tagline">Your trading data, interpreted.</p>
        <p className="support">
          TraderOS surfaces the patterns, risks and behaviours worth your attention.
        </p>
      </header>

      {accountId ? (
        <AnalyticsDrilldownProvider
          accountId={accountId}
          currency={currency}
          timezone={dash?.lab?.metadata?.timezone}
          filters={applied}
          onFiltersChange={setApplied}
        >
          <FindingDetailProvider>
            <div className="filters" aria-label="Intelligence filters">
              <AnalyticsFilters
                draft={draft}
                setDraft={setDraft}
                data={dash}
                onApply={() => setApplied({ ...draft })}
                onReset={() => {
                  const reset = filtersWithGlobalPeriod(globalFilters.period);
                  setDraft(reset);
                  setApplied(reset);
                }}
              />
              {dash && (
                <DrilldownFilterBar filters={applied} data={dash} onChange={setApplied} excludePeriod />
              )}
            </div>
            <main id="intel-main">{body}</main>
            <FindingDetailDrawer periodLabel={activePeriodLabel} accountId={accountId} />
          </FindingDetailProvider>
        </AnalyticsDrilldownProvider>
      ) : (
        <main id="intel-main">{body}</main>
      )}

      <style jsx>{`
        .page {
          display: grid;
          gap: 14px;
          max-width: 1120px;
        }
        .skip {
          position: absolute;
          left: -9999px;
          top: 0;
          z-index: 100;
          padding: 8px 12px;
          background: var(--accent);
          color: var(--accent-contrast);
          font-size: 13px;
          font-weight: 650;
          text-decoration: none;
          border-radius: 6px;
        }
        .skip:focus {
          left: 12px;
          top: 12px;
        }
        .hero {
          display: grid;
          gap: 4px;
          max-width: 640px;
        }
        h1 {
          margin: 0;
          font-size: clamp(1.45rem, 2.8vw, 1.85rem);
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .tagline {
          margin: 0;
          font-size: 1rem;
          font-weight: 550;
          color: var(--text-primary);
        }
        .support {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-muted);
        }
        .filters {
          display: grid;
          gap: 8px;
        }
        .center {
          display: grid;
          gap: 14px;
        }
        .maturity {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .enrich {
          margin: -4px 0 0;
          font-size: 11px;
        }
        .ai-note {
          margin: 0;
          font-size: 12px;
          line-height: 1.45;
          max-width: 52ch;
        }
        @media (max-width: 700px) {
          .page {
            gap: 12px;
          }
          .center {
            gap: 12px;
          }
          h1 {
            font-size: 1.35rem;
          }
        }
      `}</style>
    </div>
  );
}
