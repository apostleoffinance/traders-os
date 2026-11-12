"use client";

import type { ReactNode } from "react";

const cardStyles = `
  .metric-card {
    position: relative;
    text-align: left;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
    min-height: 92px;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }
  .metric-card.clickable {
    cursor: pointer;
    width: 100%;
    color: inherit;
  }
  .metric-card.clickable:hover {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
    background: color-mix(in srgb, var(--accent-soft) 35%, var(--surface));
  }
  .label {
    display: block;
    max-width: 100%;
    font-size: 12px;
    line-height: 1.35;
    text-transform: uppercase;
    letter-spacing: 0.045em;
    color: var(--text-secondary);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .value {
    display: block;
    max-width: 100%;
    font-size: clamp(21px, 1.45vw, 24px);
    font-weight: 650;
    font-family: var(--font-mono), ui-monospace, Menlo, monospace;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
    color: var(--text-primary);
  }
  .value.pos { color: var(--pos); }
  .value.neg { color: var(--neg); }
  .value.warn { color: var(--warning); }
  .value.ok { color: var(--success); }
  .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 4px 8px;
    width: 100%;
    margin-top: auto;
  }
  .delta {
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .delta.pos { color: var(--pos); }
  .delta.neg { color: var(--neg); }
  .hint {
    font-size: 12px;
    line-height: 1.4;
    color: var(--text-muted);
    overflow-wrap: anywhere;
  }
  .spark-wrap {
    width: 100%;
    min-width: 0;
    margin-top: 2px;
  }
  .progress-track {
    width: 100%;
    height: 3px;
    background: var(--surface-2);
    border-radius: 2px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
  }
  @media (max-width: 640px) {
    .metric-card { padding: 12px 14px; min-height: 84px; }
    .value { font-size: 21px; }
  }
`;

export function MetricCard({
  label,
  value,
  hint,
  delta,
  deltaLabel,
  tone,
  onClick,
  spark,
  progress,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: string | null;
  deltaLabel?: string;
  tone?: "pos" | "neg" | "warn" | "ok" | "";
  onClick?: () => void;
  spark?: ReactNode;
  progress?: number;
}) {
  const inner = (
    <>
      <span className="label">{label}</span>
      <span className={`value ${tone ?? ""}`}>{value}</span>
      {progress != null && (
        <div className="progress-track" aria-hidden>
          <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
      {spark ? <div className="spark-wrap">{spark}</div> : null}
      <div className="meta">
        {delta ? (
          <span className={`delta ${delta.startsWith("-") ? "neg" : "pos"}`}>
            {delta.startsWith("-") ? "▼" : "▲"} {delta}
            {deltaLabel ? <span className="hint"> {deltaLabel}</span> : null}
          </span>
        ) : hint ? (
          <span className="hint">{hint}</span>
        ) : (
          <span />
        )}
        {delta && hint ? <span className="hint">{hint}</span> : null}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="metric-card clickable" onClick={onClick}>
        {inner}
        <style jsx>{cardStyles}</style>
      </button>
    );
  }

  return (
    <div className="metric-card">
      {inner}
      <style jsx>{cardStyles}</style>
    </div>
  );
}
