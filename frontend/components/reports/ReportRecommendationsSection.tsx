"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import type { PerformanceReport } from "@/lib/reports";

export function ReportRecommendationsSection({
  recommendations,
}: {
  recommendations: PerformanceReport["recommendations"];
}) {
  return (
    <>
      <h2 className="section-title">What deserves your attention next?</h2>
      <p className="disclaimer">{recommendations.disclaimer}</p>
      <div className="cols">
        <RecCol title="Keep" items={recommendations.keep} tone="keep" />
        <RecCol title="Review" items={recommendations.review} tone="review" />
        <RecCol title="Reduce" items={recommendations.reduce} tone="reduce" />
      </div>
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
        .cols {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
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

function RecCol({
  title,
  items,
  tone,
}: {
  title: string;
  items: { id: string; text: string }[];
  tone: "keep" | "review" | "reduce";
}) {
  return (
    <ChartCard title={title}>
      {items.length === 0 ? (
        <p className="empty">None identified for this period.</p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.id}>{i.text}</li>
          ))}
        </ul>
      )}
      <style jsx>{`
        ul {
          margin: 0;
          padding-left: 18px;
          font-size: 14px;
          line-height: 1.5;
        }
        .empty {
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </ChartCard>
  );
}
