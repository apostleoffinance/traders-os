"use client";

import type { PerformanceReport } from "@/lib/reports";
import { STATUS_TONE } from "@/lib/reports";

export function ReportHeader({ data }: { data: PerformanceReport }) {
  const sc = data.executive_summary.scorecard;
  const st = data.executive_summary.status;
  const tone = STATUS_TONE[st.status] ?? "neutral";
  const typeLabel = data.report.type.toUpperCase();

  return (
    <header className={`cover tone-${tone}`}>
      <p className="brand">TRADER OS</p>
      <h1>Performance Intelligence Report</h1>
      <p className="period">{data.period.label}</p>
      <div className="meta">
        <span>Account · {data.account.name}</span>
        {data.period.start && data.period.end && (
          <span>
            Period · {data.period.start.slice(0, 10)} — {data.period.end.slice(0, 10)}
          </span>
        )}
        <span>Generated · {new Date(data.report.generated_at).toLocaleDateString()}</span>
      </div>
      <div className="hero-metrics">
        <div className="metric primary">
          <span className="label">Net performance</span>
          <strong>{sc.net_performance.value}</strong>
          {sc.net_performance.return_pct && <em>{sc.net_performance.return_pct}</em>}
        </div>
        <div className="metric">
          <span className="label">Profit factor</span>
          <strong>{sc.profit_factor ?? "—"}</strong>
        </div>
        <div className="metric">
          <span className="label">Expectancy</span>
          <strong>{sc.expectancy_r ? `${sc.expectancy_r}R` : "—"}</strong>
        </div>
        <div className="metric">
          <span className="label">Discipline</span>
          <strong>{sc.discipline != null ? `${sc.discipline}/100` : "—"}</strong>
        </div>
        <div className="metric">
          <span className="label">Trades</span>
          <strong>{sc.trades}</strong>
        </div>
      </div>
      <div className={`status-pill tone-${tone}`}>
        <span className="status-label">Performance status</span>
        <strong>{st.headline}</strong>
      </div>
      <p className="type-tag">{typeLabel} REPORT</p>
      <style jsx>{`
        .cover {
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 28px 32px 24px;
          margin-bottom: 32px;
          background: linear-gradient(145deg, var(--surface) 0%, var(--surface-2) 100%);
        }
        .brand {
          font-size: 11px;
          letter-spacing: 0.2em;
          color: var(--muted);
          margin: 0 0 8px;
        }
        h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .period {
          font-size: 20px;
          color: var(--muted);
          margin: 6px 0 16px;
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 24px;
        }
        .hero-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 16px;
          margin-bottom: 20px;
        }
        .metric {
          border-top: 2px solid var(--border);
          padding-top: 10px;
        }
        .metric.primary strong {
          font-size: 26px;
        }
        .label {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted);
          margin-bottom: 4px;
        }
        strong {
          font-family: var(--font-mono), monospace;
          font-size: 20px;
        }
        em {
          display: block;
          font-style: normal;
          font-size: 13px;
          color: var(--muted);
        }
        .status-pill {
          display: inline-flex;
          flex-direction: column;
          padding: 10px 16px;
          border-radius: 8px;
          border: 1px solid var(--border);
        }
        .status-pill.tone-pos {
          border-color: var(--pos);
          background: color-mix(in srgb, var(--pos) 8%, transparent);
        }
        .status-pill.tone-neg {
          border-color: var(--neg);
          background: color-mix(in srgb, var(--neg) 8%, transparent);
        }
        .status-pill.tone-warn {
          border-color: var(--warn, #c9a227);
        }
        .status-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
        }
        .type-tag {
          margin: 16px 0 0;
          font-size: 11px;
          color: var(--muted);
        }
      `}</style>
    </header>
  );
}
