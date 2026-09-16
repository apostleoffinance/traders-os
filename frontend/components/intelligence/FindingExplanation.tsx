"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { AI_UNAVAILABLE_MESSAGE, formatAiError, useAiStatus } from "@/lib/ai";
import {
  buildExplanationRequest,
  confidenceText,
  type Finding,
} from "@/lib/intelligence";
import { Alert, Button } from "@/components/ui";

type ExplanationResult = {
  what_this_means?: string;
  possible_interpretation?: string;
  what_to_investigate?: string[];
  caveats?: string[];
  evidence_quality_restated?: string;
};

type AIEnvelope = {
  id: string;
  analysis_type: string;
  provider: string;
  model: string;
  cached: boolean;
  created_at: string | null;
  result: ExplanationResult;
};

/**
 * AI explains a deterministic finding. Numbers come only from the finding payload.
 * Progressive disclosure — sits after Evidence / Investigate in the drawer.
 */
export function FindingExplanation({
  finding,
  accountId,
  periodLabel,
}: {
  finding: Finding;
  accountId: string;
  periodLabel?: string;
}) {
  const status = useAiStatus();
  const available = status?.available ?? true;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AIEnvelope | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    setBusy(false);
  }, [finding.id]);

  async function run(force = false) {
    if (!available) {
      setError(AI_UNAVAILABLE_MESSAGE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = buildExplanationRequest(finding, periodLabel);
      const q = force ? "?force=true" : "";
      const res = await api<AIEnvelope>(`/api/ai/accounts/${accountId}/finding-explanation${q}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setData(res);
    } catch (err) {
      setError(formatAiError(err));
    } finally {
      setBusy(false);
    }
  }

  const result = data?.result;
  const facts = confidenceText(finding.confidence, finding.sampleSize);

  return (
    <details className="explain">
      <summary id="ai-explain-title">What does this mean? (optional AI)</summary>
      <div className="panel" role="region" aria-labelledby="ai-explain-title">
        <p className="note">
          Explains the locked facts above. It cannot invent P&L, trade counts, or confidence.
        </p>
        <p className="facts-lock" title="Authoritative facts sent to the model">
          Facts locked: {facts}
          {finding.metric ? ` · ${finding.metric.label} ${finding.metric.value}` : ""}
        </p>

        <div className="actions">
          <Button type="button" onClick={() => void run(false)} disabled={busy || !available}>
            {busy ? "Explaining…" : data ? "Refresh explanation" : "Explain this signal"}
          </Button>
          {data && available ? (
            <Button type="button" kind="ghost" onClick={() => void run(true)} disabled={busy}>
              Regenerate
            </Button>
          ) : null}
        </div>

        {!available && !data ? <Alert kind="warn">{AI_UNAVAILABLE_MESSAGE}</Alert> : null}
        {error ? <Alert kind="warn">{error}</Alert> : null}

        {result ? (
          <div className="result">
            <p className="meta muted">
              {data?.provider}
              {data?.cached ? " · cached" : ""} · interpretation only — not a new calculation
            </p>
            {result.what_this_means ? (
              <div className="block">
                <h4>What this means</h4>
                <p>{result.what_this_means}</p>
              </div>
            ) : null}
            {result.possible_interpretation ? (
              <div className="block">
                <h4>Possible interpretation</h4>
                <p>{result.possible_interpretation}</p>
              </div>
            ) : null}
            {result.what_to_investigate?.length ? (
              <div className="block">
                <h4>What to investigate</h4>
                <ul>
                  {result.what_to_investigate.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.caveats?.length ? (
              <div className="block">
                <h4>Caveats</h4>
                <ul>
                  {result.caveats.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.evidence_quality_restated ? (
              <p className="restated">Evidence quality: {result.evidence_quality_restated}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <style jsx>{`
        .explain {
          display: grid;
          gap: 8px;
          padding-top: 4px;
          border-top: 1px solid var(--border);
        }
        summary {
          cursor: pointer;
          font-size: 12px;
          font-weight: 650;
          color: var(--text-secondary);
          list-style: none;
        }
        summary::-webkit-details-marker {
          display: none;
        }
        summary::before {
          content: "▸ ";
          color: var(--text-muted);
        }
        .explain[open] summary::before {
          content: "▾ ";
        }
        summary:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .panel {
          display: grid;
          gap: 8px;
          margin-top: 8px;
        }
        .note {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .facts-lock {
          margin: 0;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          padding: 8px 10px;
          border-radius: 6px;
          background: color-mix(in srgb, var(--surface-2) 80%, transparent);
          border: 1px solid var(--border);
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .result {
          display: grid;
          gap: 12px;
          margin-top: 4px;
        }
        .meta {
          margin: 0;
          font-size: 11px;
        }
        .block h4 {
          margin: 0 0 4px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--accent-text, var(--accent));
        }
        .block p {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
        }
        .block ul {
          margin: 0;
          padding-left: 1.1rem;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
        }
        .restated {
          margin: 0;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
        }
      `}</style>
    </details>
  );
}
