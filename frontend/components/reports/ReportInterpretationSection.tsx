"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import type { ReportInterpretation } from "@/lib/reports";

export function ReportInterpretationSection({ interpretation }: { interpretation: ReportInterpretation }) {
  const r = interpretation.result;

  return (
    <>
      <h2 className="section-title">AI interpretation</h2>
      <p className="disclaimer">
        Narrative generated from deterministic report findings. Metrics are not recalculated by AI.
        {interpretation.cached ? " · Cached analysis" : ""}
      </p>

      <ChartCard title="Executive narrative" subtitle={`Confidence: ${r.confidence.replace(/_/g, " ")}`}>
        <p className="narrative">{r.executive_summary}</p>
      </ChartCard>

      {r.key_observations.length > 0 && (
        <ChartCard title="Key observations">
          <ul className="observations">
            {r.key_observations.map((obs, i) => (
              <li key={i}>
                <span className="cat">{obs.category}</span>
                <p>{obs.observation}</p>
                {obs.evidence.length > 0 && (
                  <p className="evidence">Evidence: {obs.evidence.join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        </ChartCard>
      )}

      {r.data_limitations.length > 0 && (
        <ChartCard title="Data limitations noted by AI">
          <ul>
            {r.data_limitations.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </ChartCard>
      )}

      {(r.keep.length > 0 || r.review.length > 0 || r.reduce.length > 0) && (
        <div className="cols">
          <AiRecCol title="Keep (AI)" items={r.keep} />
          <AiRecCol title="Review (AI)" items={r.review} />
          <AiRecCol title="Reduce (AI)" items={r.reduce} />
        </div>
      )}

      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 8px;
        }
        .disclaimer {
          font-size: 13px;
          color: var(--muted);
          margin-bottom: 16px;
        }
        .narrative {
          font-size: 15px;
          line-height: 1.65;
          margin: 0;
        }
        .observations {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .observations li {
          padding: 12px 0;
          border-bottom: 1px solid var(--border);
        }
        .cat {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
        }
        .observations p {
          margin: 4px 0 0;
          font-size: 14px;
        }
        .evidence {
          font-size: 12px;
          color: var(--muted);
        }
        .cols {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-top: 16px;
        }
        @media (max-width: 900px) {
          .cols {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

function AiRecCol({ title, items }: { title: string; items: { text: string; evidence: string[] }[] }) {
  if (!items.length) return null;
  return (
    <ChartCard title={title}>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{item.text}</li>
        ))}
      </ul>
      <style jsx>{`
        ul {
          margin: 0;
          padding-left: 18px;
          font-size: 14px;
          line-height: 1.5;
        }
      `}</style>
    </ChartCard>
  );
}
