"use client";

import { useMemo } from "react";
import { ChartCard } from "@/components/trader/ChartCard";
import { MetricCard } from "@/components/trader/MetricCard";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { num } from "@/lib/format";

/**
 * L1 Execution answers — sizing, hold time, exit capture — before bucket charts.
 */
export function ExecutionAnswerStrip({ data }: { data: AnalyticsDashboard }) {
  const lab = data.lab?.execution;
  if (!lab) return null;

  const sizeBuckets = lab.position_size.buckets.filter((b) => b.n > 0);
  const bestSize = [...sizeBuckets].sort(
    (a, b) => Number(b.expectancy_r ?? -999) - Number(a.expectancy_r ?? -999),
  )[0];
  const durBuckets = lab.duration.buckets.filter((b) => b.n > 0);
  const bestDur = [...durBuckets].sort(
    (a, b) => Number(b.expectancy_r ?? -999) - Number(a.expectancy_r ?? -999),
  )[0];
  const exit = lab.exit_efficiency;
  const capture = exit.median_capture_pct != null ? Number(exit.median_capture_pct) : null;

  const takeaways = useMemo(() => {
    const parts: string[] = [];
    if (bestSize) {
      parts.push(
        `Best size bucket by expectancy: ${bestSize.bucket} (${bestSize.expectancy_r != null ? `${num(bestSize.expectancy_r)}R` : "—"}, n=${bestSize.n}).`,
      );
    }
    if (bestDur) {
      parts.push(
        `Best hold-time bucket: ${bestDur.bucket} (${bestDur.expectancy_r != null ? `${num(bestDur.expectancy_r)}R` : "—"}, n=${bestDur.n}).`,
      );
    }
    if (capture != null) {
      parts.push(
        capture >= 50
          ? `Median MFE capture ${num(capture, 1)}% — exits are retaining a meaningful share of favorable move.`
          : `Median MFE capture ${num(capture, 1)}% — winners may be left early relative to excursion.`,
      );
    }
    return parts.join(" ");
  }, [bestSize, bestDur, capture]);

  return (
    <ChartCard
      title="Execution snapshot"
      question="Am I sizing, holding, and exiting well?"
      tier="essential"
      insight={
        takeaways
          ? {
              summary: "Observed execution patterns in this filter.",
              observation: takeaways,
              takeaway: "Use the charts below to verify — association, not causation.",
              direction: capture != null && capture < 40 ? "mixed" : "neutral",
            }
          : null
      }
    >
      <div className="grid">
        <MetricCard
          label="Best size bucket"
          value={bestSize?.bucket ?? "—"}
          hint={bestSize ? `n=${bestSize.n}${bestSize.expectancy_r ? ` · ${num(bestSize.expectancy_r)}R` : ""}` : "Need position size data"}
        />
        <MetricCard
          label="Best hold bucket"
          value={bestDur?.bucket ?? "—"}
          hint={bestDur ? `n=${bestDur.n}${bestDur.expectancy_r ? ` · ${num(bestDur.expectancy_r)}R` : ""}` : "Need hold times"}
        />
        <MetricCard
          label="Median MFE capture"
          value={capture != null ? `${num(capture, 1)}%` : "—"}
          hint={exit.available ? "Share of favorable move kept at exit" : "Needs MFE on closed trades"}
          tone={capture != null && capture < 40 ? "warn" : capture != null && capture >= 55 ? "ok" : undefined}
        />
      </div>
      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }
      `}</style>
    </ChartCard>
  );
}
