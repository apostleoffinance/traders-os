"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getActiveAccountId } from "@/lib/api";
import { useAiStatus } from "@/lib/ai";
import { IntelligenceRunner } from "@/components/IntelligenceRunner";
import { Alert, Field } from "@/components/ui";

const PRESETS: { id: string; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "this_week", label: "This week" },
  { id: "last_7_days", label: "Last 7 days" },
  { id: "this_month", label: "This month" },
  { id: "last_30_days", label: "Last 30 days" },
  { id: "last_20", label: "Last 20 trades" },
  { id: "last_50", label: "Last 50 trades" },
  { id: "last_100", label: "Last 100 trades" },
  { id: "custom", label: "Custom" },
];

type Preview = {
  n: number;
  previous_n: number;
  expectancy_r: string | null;
  period: { label: string; kind: string };
};

function periodPreviewCopy(preview: Preview): string {
  const label = preview.period.label;
  if (preview.n === 0) {
    return `${label} has no trades yet.`;
  }
  if (preview.n < 10) {
    const unit = preview.n === 1 ? "trade" : "trades";
    return `${preview.n} ${unit} in this window. Too small to treat as a pattern.`;
  }
  const expectancy = preview.expectancy_r != null ? ` Expectancy ${preview.expectancy_r}R.` : "";
  const previous = preview.previous_n ? ` Previous window: ${preview.previous_n} trades.` : "";
  return `${label}: ${preview.n} trades.${expectancy}${previous}`;
}

export function PeriodReview() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [preset, setPreset] = useState("this_week");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const aiStatus = useAiStatus();

  useEffect(() => {
    setAccountId(getActiveAccountId());
    const on = () => setAccountId(getActiveAccountId());
    window.addEventListener("traderos-account", on);
    return () => window.removeEventListener("traderos-account", on);
  }, []);

  const query = useMemo(() => {
    const params = new URLSearchParams({ preset });
    if (preset === "custom") {
      if (start) params.set("start", start);
      if (end) params.set("end", end);
    }
    return params.toString();
  }, [preset, start, end]);

  const ready = Boolean(accountId) && (preset !== "custom" || (start && end));

  useEffect(() => {
    if (!ready || !accountId) {
      setPreview(null);
      return;
    }
    let alive = true;
    setError(null);
    void api<Preview>(`/api/ai/accounts/${accountId}/period?${query}`)
      .then((data) => {
        if (alive) setPreview(data);
      })
      .catch((err: Error) => {
        if (alive) {
          setPreview(null);
          setError(err.message);
        }
      });
    return () => {
      alive = false;
    };
  }, [accountId, query, ready]);

  const path = ready && accountId ? `/api/ai/accounts/${accountId}/period-review?${query}` : null;

  return (
    <div>
      <div className="chips">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={preset === p.id ? "chip on" : "chip"}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="dates">
          <Field label="From">
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
      )}
      {error && <Alert kind="danger">{error}</Alert>}
      {preview && <p className="muted">{periodPreviewCopy(preview)}</p>}
      <IntelligenceRunner
        key={query}
        path={path}
        label="Analyze this period"
        hint="The engines slice the journal first. The model only explains the selected window versus the previous one."
        available={aiStatus?.available ?? true}
      />
      <style jsx>{`
        .chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }
        .chip {
          border: 1px solid var(--line-strong);
          background: transparent;
          padding: 5px 10px;
          font-size: 12px;
          letter-spacing: 0.02em;
        }
        .chip.on {
          background: var(--accent);
          color: var(--accent-contrast);
          border-color: var(--accent);
        }
        .dates {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }
      `}</style>
    </div>
  );
}
