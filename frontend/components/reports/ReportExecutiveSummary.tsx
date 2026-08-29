"use client";

import type { PerformanceReport } from "@/lib/reports";

export function ReportExecutiveSummary({
  data,
  aiSummary,
}: {
  data: PerformanceReport;
  aiSummary?: string;
}) {
  const seeds = data.executive_summary.narrative_seed;
  const factors = data.executive_summary.status.factors;

  return (
    <div className="block">
      <h2 className="section-title">Executive summary</h2>
      {aiSummary && <p className="ai-narrative">{aiSummary}</p>}
      <ul className="bullets">
        {seeds.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {factors.length > 0 && (
        <div className="factors">
          <h3>Status drivers</h3>
          <ul>
            {factors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="confidence">{data.confidence.message}</p>
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 12px;
          letter-spacing: 0.02em;
        }
        .ai-narrative {
          font-size: 15px;
          line-height: 1.65;
          margin: 0 0 16px;
          padding: 14px 16px;
          border-left: 3px solid var(--accent);
          background: color-mix(in srgb, var(--accent) 6%, transparent);
          border-radius: 0 8px 8px 0;
        }
        .bullets {
          margin: 0 0 16px;
          padding-left: 20px;
          line-height: 1.6;
        }
        .factors h3 {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
        }
        .factors ul {
          margin: 0;
          padding-left: 18px;
          font-size: 14px;
          color: var(--muted);
        }
        .confidence {
          font-size: 13px;
          color: var(--muted);
          margin-top: 12px;
        }
      `}</style>
    </div>
  );
}
