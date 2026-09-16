"use client";

import type { ReactNode } from "react";

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
      {spark}
      {delta && (
        <span className={`delta ${delta.startsWith("-") ? "neg" : "pos"}`}>
          {deltaLabel ?? "vs prior"} {delta}
        </span>
      )}
      {hint && <span className="hint">{hint}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="metric-card clickable" onClick={onClick}>
        {inner}
        <style jsx>{`
          .metric-card {
            text-align: left;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px 14px;
            background: var(--surface);
            cursor: pointer;
            display: flex;
            flex-direction: column;
            gap: 4px;
            min-height: 88px;
          }
          .metric-card:hover {
            border-color: var(--accent);
          }
          .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--muted);
          }
          .value {
            font-size: 22px;
            font-weight: 700;
            font-family: var(--font-mono), monospace;
            line-height: 1.1;
          }
          .value.pos {
            color: var(--pos);
          }
          .value.neg {
            color: var(--neg);
          }
          .delta {
            font-size: 12px;
          }
          .delta.pos {
            color: var(--pos);
          }
          .delta.neg {
            color: var(--neg);
          }
          .hint {
            font-size: 11px;
            color: var(--muted);
          }
          .progress-track {
            height: 4px;
            background: var(--surface-2);
            border-radius: 2px;
            overflow: hidden;
            margin-top: 4px;
          }
          .progress-fill {
            height: 100%;
            background: var(--accent);
            border-radius: 2px;
          }
        `}</style>
      </button>
    );
  }

  return (
    <div className="metric-card">
      {inner}
      <style jsx>{`
        .metric-card {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px 14px;
          background: var(--surface);
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 88px;
        }
        .label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--muted);
        }
        .value {
          font-size: 22px;
          font-weight: 700;
          font-family: var(--font-mono), monospace;
        }
        .value.pos {
          color: var(--pos);
        }
        .value.neg {
          color: var(--neg);
        }
        .hint {
          font-size: 11px;
          color: var(--muted);
        }
        .progress-track {
          height: 4px;
          background: var(--surface-2);
          border-radius: 2px;
          overflow: hidden;
          margin-top: 4px;
        }
        .progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
