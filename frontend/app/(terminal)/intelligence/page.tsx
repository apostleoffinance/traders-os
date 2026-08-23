"use client";

import { useEffect, useState } from "react";
import { api, getActiveAccountId } from "@/lib/api";
import { IntelligenceRunner } from "@/components/IntelligenceRunner";
import { PeriodReview } from "@/components/PeriodReview";
import { Alert, Panel } from "@/components/ui";

type Status = { available: boolean };

export default function IntelligencePage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    setAccountId(getActiveAccountId());
    void api<Status>("/api/ai/status").then(setStatus);
    const on = () => setAccountId(getActiveAccountId());
    window.addEventListener("traderos-account", on);
    return () => window.removeEventListener("traderos-account", on);
  }, []);

  const base = accountId ? `/api/ai/accounts/${accountId}` : null;

  return (
    <div>
      <p className="page-kicker">Insights</p>
      <h1>Intelligence</h1>
      <p className="muted">
        This layer interprets your journal. It does not tell you what to buy or sell. Numbers come from the risk and
        performance engines; the model only explains them.
      </p>
      {status && !status.available && (
        <Alert kind="warn">Analysis is unavailable right now. Journal, risk and analytics still work.</Alert>
      )}
      {!accountId && <Alert kind="info">Select an account to run intelligence.</Alert>}

      <div className="grid">
        <div className="wide">
          <Panel title="Period review">
            <PeriodReview />
          </Panel>
        </div>
        <Panel title="Behavior">
          <IntelligenceRunner
            path={base ? `${base}/behavior` : null}
            label="Analyze my behavior"
            hint="Revenge, FOMO, risk after losses, overtrading. Not a market view."
          />
        </Panel>
        <Panel title="Patterns">
          <IntelligenceRunner
            path={base ? `${base}/patterns` : null}
            label="Find behavioral / setup patterns"
            hint="Interprets deterministic buckets. Suggests investigations, not trade filters as signals."
          />
        </Panel>
        <Panel title="Trading coach">
          <IntelligenceRunner
            path={base ? `${base}/coach` : null}
            label="Ask the coach"
            hint="Process focus for the week. Memories are only user config or statistically validated history."
          />
        </Panel>
      </div>
      <style jsx>{`
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
