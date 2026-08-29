"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";

export function ReportDataQualitySection({
  dataQuality,
  confidence,
}: {
  dataQuality: Record<string, unknown>;
  confidence: { level: string; message: string };
}) {
  const completeness = dataQuality.completeness_pct as number | null | undefined;
  const missing = (dataQuality.missing ?? []) as { field: string; count: number }[];
  const sources = dataQuality.sources as Record<string, number> | undefined;

  return (
    <>
      <h2 className="section-title">Data quality</h2>
      <ChartCard title="Trade data completeness" subtitle={String(dataQuality.note ?? "")}>
        <p className="score">{completeness != null ? `${completeness}%` : "—"}</p>
        <p className="conf">{confidence.level.replace(/_/g, " ")} · {confidence.message}</p>
        {missing.length > 0 && (
          <ul>
            {missing.map((m) => (
              <li key={m.field}>
                {m.field.replace(/_/g, " ")}: {m.count} trades
              </li>
            ))}
          </ul>
        )}
        {sources && (
          <p className="sources">
            Sources — Manual: {sources.manual} · MT5: {sources.mt5} · Other: {sources.other}
          </p>
        )}
      </ChartCard>
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 16px;
        }
        .score {
          font-size: 32px;
          font-family: var(--font-mono), monospace;
          margin: 0 0 8px;
        }
        .conf {
          font-size: 13px;
          color: var(--muted);
        }
        ul {
          margin: 12px 0 0;
          padding-left: 18px;
          font-size: 13px;
        }
        .sources {
          margin-top: 12px;
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </>
  );
}
