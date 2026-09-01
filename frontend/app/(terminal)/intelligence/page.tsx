"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import type { IntelligenceFeedResponse } from "@/lib/intelligence";
import { IntelligenceRunner } from "@/components/IntelligenceRunner";
import { IntelligenceFeedPanel } from "@/components/intelligence/IntelligenceFeed";
import {
  BehaviourIntelligenceLab,
  ChecklistItemPanel,
  EdgeMapPanel,
  IntelligenceOverview,
  PlaybookLab,
} from "@/components/intelligence/Phase3Intelligence";
import {
  DecisionQualityChart,
  DisciplineScatterPanel,
  PsychologyBubbleMatrix,
} from "@/components/intelligence/IntelligenceViz";
import { AnalyticsDrilldownProvider } from "@/components/analytics/AnalyticsDrilldownContext";
import { AnalyticsFilters } from "@/components/analytics/Filters";
import { DrilldownFilterBar } from "@/components/analytics/primitives/DrilldownFilterBar";
import { PeriodReview } from "@/components/PeriodReview";
import { Alert, Panel } from "@/components/ui";

function periodLabel(preset: string): string {
  return PERIOD_LABELS[preset as PeriodPreset] ?? preset;
}

export default function IntelligencePage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [feed, setFeed] = useState<IntelligenceFeedResponse | null>(null);
  const [intel, setIntel] = useState<IntelligenceLabPayload | null>(null);
  const [dash, setDash] = useState<AnalyticsDashboard | null>(null);
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
      return;
    }
    const seq = ++loadSeq.current;
    const q = buildAnalyticsQuery(id, filters);
    try {
      const [feedRes, intelRes, dashRes] = await Promise.all([
        api<IntelligenceFeedResponse>(`/api/intelligence/feed?account_id=${id}&preset=${filters.preset}`),
        api<IntelligenceLabPayload>(`/api/analytics/intelligence?${q}`),
        api<AnalyticsDashboard>(`/api/analytics/dashboard?${q}`),
      ]);
      if (seq !== loadSeq.current) return;
      setFeed(feedRes);
      setIntel(intelRes);
      setDash(dashRes);
    } catch {
      if (seq !== loadSeq.current) return;
    }
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    void load(applied);
    const onAccount = () => void load(applied);
    window.addEventListener("traderos-account", onAccount);
    return () => window.removeEventListener("traderos-account", onAccount);
  }, [applied, filtersReady, load]);

  const tradesInPeriod = dash?.overview.n_trades ?? intel?.metadata.trades_analyzed;
  const activePeriodLabel = periodLabel(applied.preset);

  const base = accountId ? `/api/ai/accounts/${accountId}` : null;
  const currency = dash?.account.currency ?? "USD";

  const body = (
    <>
      {status && !status.available && <Alert kind="warn">{status.message ?? AI_UNAVAILABLE_MESSAGE}</Alert>}
      {!accountId && <Alert kind="info">Select an account to load the feed.</Alert>}
      {!feed && accountId && filtersReady && <p className="muted">Loading insights…</p>}

      {dash && filtersReady && tradesInPeriod != null && (
        <p className="period-context muted">
          <strong>{tradesInPeriod}</strong> closed trade{tradesInPeriod === 1 ? "" : "s"} opened or closed in{" "}
          <strong>{activePeriodLabel}</strong>
          {tradesInPeriod === 0
            ? " — try a longer period or log trades in this window."
            : tradesInPeriod < 10
              ? " — some pattern insights need at least 10 trades in the window."
              : "."}
        </p>
      )}

      {intel && (
        <div className="phase3">
          <IntelligenceOverview intel={intel} />
          <PsychologyBubbleMatrix intel={intel} currency={currency} />
          <DisciplineScatterPanel intel={intel} currency={currency} />
          <BehaviourIntelligenceLab intel={intel} />
          <DecisionQualityChart intel={intel} />
          <PlaybookLab intel={intel} />
          <ChecklistItemPanel intel={intel} />
          <EdgeMapPanel intel={intel} />
        </div>
      )}

      {feed && (
        <div className="feed-block">
          <IntelligenceFeedPanel data={feed} tradesInPeriod={tradesInPeriod ?? undefined} />
        </div>
      )}

      <div className="grid">
        <div className="wide">
          <Panel title="Period review">
            <PeriodReview />
          </Panel>
        </div>
        <Panel title="AI · Behavior">
          <IntelligenceRunner
            path={base ? `${base}/behavior` : null}
            label="Analyze my behavior"
            hint="Revenge, FOMO, risk after losses, overtrading. Not a market view."
            available={status?.available ?? true}
          />
        </Panel>
        <Panel title="AI · Patterns">
          <IntelligenceRunner
            path={base ? `${base}/patterns` : null}
            label="Find behavioral / setup patterns"
            hint="Interprets deterministic buckets. Suggests investigations, not trade filters as signals."
            available={status?.available ?? true}
          />
        </Panel>
        <Panel title="AI · Coach">
          <IntelligenceRunner
            path={base ? `${base}/coach` : null}
            label="Ask the coach"
            hint="Process focus for the week. Memories are only user config or statistically validated history."
            available={status?.available ?? true}
          />
        </Panel>
      </div>
    </>
  );

  return (
    <div>
      <p className="page-kicker">Intelligence</p>
      <h1>Trading Intelligence</h1>
      <p className="muted intro">
        Living intelligence from your journal — edge, behaviour, risk, and discipline. Every card is deterministic
        with evidence. Click charts to drill into matching trades.
      </p>

      {accountId ? (
        <AnalyticsDrilldownProvider
          accountId={accountId}
          currency={currency}
          timezone={dash?.lab?.metadata?.timezone}
          filters={applied}
          onFiltersChange={setApplied}
        >
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
          {body}
        </AnalyticsDrilldownProvider>
      ) : (
        body
      )}

      <style jsx>{`
        .intro {
          max-width: 640px;
          margin-bottom: 16px;
        }
        .period-context {
          margin: 0 0 14px;
          font-size: 13px;
          max-width: 640px;
        }
        .feed-block {
          margin-bottom: 20px;
        }
        .phase3 {
          display: grid;
          gap: 14px;
          margin-bottom: 20px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .wide {
          grid-column: 1 / -1;
        }
        @media (max-width: 900px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
