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
  intelligenceActivityStatus,
  type Finding,
  type IntelligenceFeedResponse,
  type IntelligenceEngineResult,
} from "@/lib/intelligence";
import { FindingDetailProvider, useFindingDetail } from "@/components/intelligence/FindingDetailContext";
import { IntelligenceMethodology } from "@/components/intelligence/IntelligenceMethodology";
import {
  IntelligenceEarlyDataState,
  IntelligenceEmptyState,
  IntelligenceErrorState,
  IntelligenceNoFindingState,
} from "@/components/intelligence/IntelligenceStates";
import { InvestigateNext, InvestigateNextSkeleton } from "@/components/intelligence/InvestigateNext";
import { TradingPulse, TradingPulseSkeleton } from "@/components/intelligence/TradingPulse";
import { SelectedEvidence } from "@/components/intelligence/signals/SelectedEvidence";
import { SignalSection, SignalSectionSkeleton } from "@/components/intelligence/signals/SignalSection";
import { AnalyticsDrilldownProvider } from "@/components/analytics/AnalyticsDrilldownContext";
import { AnalyticsFilters } from "@/components/analytics/Filters";
import { DrilldownFilterBar } from "@/components/analytics/primitives/DrilldownFilterBar";
import { Alert } from "@/components/ui";

const FindingDetailDrawer = dynamic(
  () => import("@/components/intelligence/FindingDetailDrawer").then((m) => m.FindingDetailDrawer),
  { ssr: false },
);

const BehaviourSignals = dynamic(
  () =>
    import("@/components/intelligence/behaviour/BehaviourSignals").then((m) => m.BehaviourSignals),
  { ssr: false },
);

const TradeStories = dynamic(
  () => import("@/components/intelligence/trades/TradeStories").then((m) => m.TradeStories),
  { ssr: false },
);

function periodLabel(preset: string): string {
  return PERIOD_LABELS[preset as PeriodPreset] ?? preset;
}

/** Sync selected evidence with drawer opens so Signal → Evidence stays aligned. */
function SelectedFindingBridge({
  selectedId,
  onSelect,
  findings,
}: {
  selectedId: string | null;
  onSelect: (f: Finding | null) => void;
  findings: Finding[];
}) {
  const { finding } = useFindingDetail();
  useEffect(() => {
    if (!finding) return;
    if (finding.id !== selectedId) onSelect(finding);
  }, [finding, selectedId, onSelect]);

  // Keep selection valid when engine refreshes
  useEffect(() => {
    if (!selectedId) return;
    if (!findings.some((f) => f.id === selectedId)) onSelect(null);
  }, [findings, selectedId, onSelect]);

  return null;
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
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
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

  // Default evidence to primary when engine arrives
  useEffect(() => {
    if (!engine?.primary) return;
    setSelectedFinding((prev) => prev ?? engine.primary);
  }, [engine?.primary?.id]);

  const showSkeletons = accountId && loading && !engine;
  const showCenter = accountId && !error && engine;
  const activity =
    engine != null ? intelligenceActivityStatus(engine.tradeCount, engine.maturity) : null;

  const behaviourFindings = useMemo(
    () =>
      engine?.findings.filter(
        (f) => f.domain === "behaviour" || f.type === "BEHAVIOUR" || f.domain === "execution",
      ) ?? [],
    [engine],
  );

  const onSelectFinding = useCallback((f: Finding | null) => {
    setSelectedFinding(f);
  }, []);

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
          <TradingPulseSkeleton />
          <SignalSectionSkeleton />
          <InvestigateNextSkeleton />
        </div>
      ) : null}

      {showCenter ? (
        <div className="center" aria-live="polite">
          {engine.maturity === "empty" ? (
            <IntelligenceEmptyState tradeCount={engine.tradeCount} />
          ) : (
            <>
              {activity ? (
                <p className="status" role="status">
                  {activity}
                  {enriching ? <span className="enrich"> · refining…</span> : null}
                </p>
              ) : null}

              {dash ? <TradingPulse data={dash} maturity={engine.maturity} /> : null}

              {engine.maturity === "early" ? (
                <IntelligenceEarlyDataState tradeCount={engine.tradeCount} />
              ) : null}

              {/* LAYER 1 — Signals */}
              {engine.primary || engine.attention.length ? (
                <SignalSection
                  primary={engine.primary}
                  attention={engine.attention}
                  selectedId={selectedFinding?.id}
                  onSelect={onSelectFinding}
                />
              ) : (
                <IntelligenceNoFindingState tradeCount={engine.tradeCount} />
              )}

              {/* LAYER 2 — Evidence */}
              <SelectedEvidence
                finding={selectedFinding}
                dashboard={dash}
                onClear={() => onSelectFinding(null)}
              />

              {/* LAYER 3 — Investigation */}
              <InvestigateNext findings={engine.queue} />

              {/* Behaviour */}
              {dash ? (
                <BehaviourSignals
                  dashboard={dash}
                  lab={intel}
                  behaviourFindings={behaviourFindings}
                />
              ) : null}

              {/* Trade stories — lazy anatomy */}
              {accountId ? <TradeStories accountId={accountId} /> : null}

              {/* LAYER 4 — Methodology */}
              <IntelligenceMethodology tradeCount={engine.tradeCount} />
            </>
          )}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="page">
      <a href="#intel-main" className="skip">
        Skip to intelligence
      </a>

      <header className="hero">
        <h1>Intelligence</h1>
        <p className="tagline">Your trading, interpreted.</p>
        <p className="support">
          TraderOS connects your performance, behaviour, execution and risk to surface what deserves
          your attention.
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
            <SelectedFindingBridge
              selectedId={selectedFinding?.id ?? null}
              onSelect={onSelectFinding}
              findings={engine?.findings ?? []}
            />
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
          max-width: 560px;
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
          gap: 16px;
        }
        .status {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .enrich {
          font-weight: 500;
          color: var(--text-muted);
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
