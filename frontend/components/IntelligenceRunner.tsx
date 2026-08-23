"use client";

import { useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import { Alert, Button, Panel } from "@/components/ui";

export type AIEnvelope = {
  id: string;
  analysis_type: string;
  provider: string;
  model: string;
  cached: boolean;
  created_at: string | null;
  result: Record<string, unknown>;
};

function renderValue(value: unknown): ReactNode {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="muted">None recorded.</span>;
    if (value.every((x) => typeof x === "string")) {
      return (
        <ul>
          {value.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      );
    }
    return (
      <div>
        {value.map((item, i) => (
          <div key={i} className="card">
            {renderValue(item)}
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <dl>
        {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
          <div key={k}>
            <dt>{k.replace(/_/g, " ")}</dt>
            <dd>{renderValue(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return String(value);
}

export function IntelligenceRunner({
  path,
  label,
  hint,
}: {
  path: string | null;
  label: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AIEnvelope | null>(null);

  async function run(force = false) {
    if (!path) {
      setError("Select an account first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const sep = path.includes("?") ? "&" : "?";
      const res = await api<AIEnvelope>(`${path}${force ? `${sep}force=true` : ""}`, { method: "POST" });
      setData(res);
    } catch (err) {
      if (err instanceof ApiError) {
        const detail = err.body as { detail?: { message?: string } | string };
        if (typeof detail?.detail === "object" && detail.detail?.message) {
          setError(detail.detail.message);
        } else if (err.status === 503) {
          setError("AI analysis temporarily unavailable. Journal, risk and analytics still work.");
        } else {
          setError(err.message);
        }
      } else {
        setError("AI analysis temporarily unavailable.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="actions">
        <Button type="button" onClick={() => void run(false)} disabled={busy || !path}>
          {busy ? "Analyzing…" : label}
        </Button>
        {data && (
          <Button type="button" kind="ghost" onClick={() => void run(true)} disabled={busy}>
            Regenerate
          </Button>
        )}
      </div>
      {hint && <p className="muted">{hint}</p>}
      {error && <Alert kind="danger">{error}</Alert>}
      {data && (
        <Panel
          title={`${data.analysis_type.replace(/_/g, " ")} · ${data.provider}${data.cached ? " · cached" : ""}`}
        >
          <div className="finding">{renderValue(data.result)}</div>
        </Panel>
      )}
      <style jsx>{`
        .actions {
          display: flex;
          gap: 8px;
          margin-bottom: 10px;
        }
        :global(ul) {
          margin: 0;
          padding-left: 18px;
        }
        :global(.card) {
          border: 1px solid var(--border);
          background: var(--surface-elevated);
          border-radius: var(--radius-sm);
          padding: 12px;
          margin-top: 10px;
        }
        :global(dt) {
          color: var(--text-muted);
          font-size: 10.5px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-top: 10px;
        }
        :global(dd) {
          margin: 4px 0 0;
        }
      `}</style>
    </div>
  );
}
