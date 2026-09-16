"use client";

import { Panel } from "@/components/ui";
import type { AnalyticsDashboard } from "@/lib/analytics";

/** Deterministic observations — sample size on every claim. */
export function KeyObservationsPanel({ data }: { data: AnalyticsDashboard }) {
  return (
    <Panel title="Key observations">
      <p className="muted">Deterministic. Every claim includes sample size. This is not trading advice.</p>
      {data.observations.length === 0 ? (
        <p className="muted">No observations for this filter yet.</p>
      ) : (
        <ul>
          {data.observations.map((o) => (
            <li key={o.title}>
              <strong>{o.title}</strong>
              <p>{o.text}</p>
              <span className="muted">
                {o.evidence.label} · n={o.sample_size} · {o.metric}
              </span>
            </li>
          ))}
        </ul>
      )}
      <style jsx>{`
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 12px;
        }
        li p {
          margin: 4px 0;
        }
        .muted {
          font-size: 12px;
          color: var(--text-muted);
        }
      `}</style>
    </Panel>
  );
}
