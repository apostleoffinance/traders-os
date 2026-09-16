"use client";

import { ChartCard } from "@/components/trader/ChartCard";
import { MetricCard } from "@/components/trader/MetricCard";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { num } from "@/lib/format";

/** Execution metrics strip — sizing / hold / capture before charts. */
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

  return (
    <ChartCard title="Execution">
      <div className="grid">
        <MetricCard
          label="Best size"
          value={bestSize?.bucket ?? "—"}
          hint={bestSize ? `n=${bestSize.n}${bestSize.expectancy_r ? ` · ${num(bestSize.expectancy_r)}R` : ""}` : undefined}
        />
        <MetricCard
          label="Best hold"
          value={bestDur?.bucket ?? "—"}
          hint={bestDur ? `n=${bestDur.n}${bestDur.expectancy_r ? ` · ${num(bestDur.expectancy_r)}R` : ""}` : undefined}
        />
        <MetricCard
          label="MFE capture"
          value={capture != null ? `${num(capture, 1)}%` : "—"}
          tone={capture != null && capture < 40 ? "warn" : capture != null && capture >= 55 ? "ok" : undefined}
        />
      </div>
      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 12px;
        }
      `}</style>
    </ChartCard>
  );
}
