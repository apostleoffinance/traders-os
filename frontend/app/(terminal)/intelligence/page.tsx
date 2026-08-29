"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getActiveAccountId } from "@/lib/api";
import { AI_UNAVAILABLE_MESSAGE, useAiStatus } from "@/lib/ai";
import { useGlobalFilters } from "@/lib/filters";
import { globalPeriodToPreset } from "@/lib/analytics";
import type { IntelligenceFeedResponse } from "@/lib/intelligence";
import { IntelligenceRunner } from "@/components/IntelligenceRunner";
import { IntelligenceFeedPanel } from "@/components/intelligence/IntelligenceFeed";
import { PeriodReview } from "@/components/PeriodReview";
import { Alert, Panel } from "@/components/ui";

export default function IntelligencePage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [feed, setFeed] = useState<IntelligenceFeedResponse | null>(null);
  const { filters } = useGlobalFilters();
  const status = useAiStatus();

  const load = useCallback(async () => {
    const id = getActiveAccountId();
    setAccountId(id);
    if (!id) {
      setFeed(null);
      return;
    }
    const preset = globalPeriodToPreset(filters.period);
    setFeed(await api<IntelligenceFeedResponse>(`/api/intelligence/feed?account_id=${id}&preset=${preset}`));
  }, [filters.period]);

  useEffect(() => {
    void load();
    const onAccount = () => void load();
    window.addEventListener("traderos-account", onAccount);
    return () => window.removeEventListener("traderos-account", onAccount);
  }, [load]);

  const base = accountId ? `/api/ai/accounts/${accountId}` : null;

  return (
    <div>
      <p className="page-kicker">Intelligence</p>
      <h1>Insights feed</h1>
      <p className="muted intro">
        Living intelligence from your journal — edge, behaviour, risk, and discipline. Every card is deterministic
        with evidence. AI deep-dives below interpret; they never invent the numbers.
      </p>

      {status && !status.available && <Alert kind="warn">{status.message ?? AI_UNAVAILABLE_MESSAGE}</Alert>}
      {!accountId && <Alert kind="info">Select an account to load the feed.</Alert>}
      {!feed && accountId && <p className="muted">Loading insights…</p>}

      {feed && (
        <div className="feed-block">
          <IntelligenceFeedPanel data={feed} />
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
      <style jsx>{`
        .intro {
          max-width: 640px;
          margin-bottom: 16px;
        }
        .feed-block {
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
