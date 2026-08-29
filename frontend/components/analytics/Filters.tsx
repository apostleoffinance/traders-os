"use client";

import { useState } from "react";
import { Field } from "@/components/ui";
import { sessionLabel } from "@/lib/format";
import type { AnalyticsDashboard, FilterState } from "@/lib/analytics";

const PRESETS = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "All" },
  { id: "custom", label: "Custom" },
];

export function AnalyticsFilters({
  draft,
  setDraft,
  data,
  onApply,
  onReset,
}: {
  draft: FilterState;
  setDraft: (f: FilterState) => void;
  data: AnalyticsDashboard | null;
  onApply: () => void;
  onReset: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const opts = data?.filters.options;
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setDraft({ ...draft, [key]: value });
  }
  return (
    <section className="bar">
      <div className="presets">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" className={draft.preset === p.id ? "on" : ""} onClick={() => set("preset", p.id)}>
            {p.label}
          </button>
        ))}
      </div>
      {draft.preset === "custom" && (
        <div className="row">
          <Field label="From">
            <input type="date" value={draft.date_from} onChange={(e) => set("date_from", e.target.value)} />
          </Field>
          <Field label="To">
            <input type="date" value={draft.date_to} onChange={(e) => set("date_to", e.target.value)} />
          </Field>
        </div>
      )}
      <div className="row primary">
        <Field label="Instrument">
          <select value={draft.symbol} onChange={(e) => set("symbol", e.target.value)}>
            <option value="">All</option>
            {(opts?.symbols ?? []).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <button type="button" className="more-btn" onClick={() => setMoreOpen((v) => !v)}>
          {moreOpen ? "Fewer filters" : "More filters"}
        </button>
      </div>
      {moreOpen && (
      <div className="row">
        <Field label="Session">
          <select value={draft.session} onChange={(e) => set("session", e.target.value)}>
            <option value="">All</option>
            {(opts?.sessions ?? []).map((s) => (
              <option key={s} value={s}>
                {sessionLabel(s)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Setup">
          <select value={draft.setup_id} onChange={(e) => set("setup_id", e.target.value)}>
            <option value="">All</option>
            {(opts?.setups ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Direction">
          <select value={draft.direction} onChange={(e) => set("direction", e.target.value)}>
            <option value="">All</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </Field>
        <Field label="Timeframe">
          <select value={draft.timeframe} onChange={(e) => set("timeframe", e.target.value)}>
            <option value="">All</option>
            {(opts?.timeframes ?? []).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Psychology">
          <select value={draft.psychology} onChange={(e) => set("psychology", e.target.value)}>
            <option value="">All</option>
            {(opts?.psychology ?? []).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Result">
          <select value={draft.result} onChange={(e) => set("result", e.target.value)}>
            <option value="">All</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="breakeven">Breakeven</option>
          </select>
        </Field>
      </div>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={onApply}>
          Apply
        </button>
        <button type="button" className="btn ghost" onClick={onReset}>
          Reset
        </button>
      </div>
      <style jsx>{`
        .bar {
          background: var(--surface);
          border: 1px solid var(--line);
          padding: 12px 14px;
          margin-bottom: 16px;
          display: grid;
          gap: 10px;
        }
        .presets,
        .actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .presets button {
          border: 1px solid var(--line-strong);
          background: transparent;
          padding: 4px 10px;
          font-size: 12px;
        }
        .presets .on {
          background: var(--accent);
          color: var(--accent-contrast);
          border-color: var(--accent);
        }
        .row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 8px;
        }
        .primary {
          grid-template-columns: minmax(140px, 200px) auto;
          align-items: end;
        }
        .more-btn {
          border: 1px dashed var(--border);
          background: transparent;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          cursor: pointer;
          border-radius: 8px;
          height: 38px;
        }
      `}</style>
    </section>
  );
}
