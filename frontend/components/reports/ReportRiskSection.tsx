"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { UnderwaterCurve } from "@/components/visualizations/risk/UnderwaterCurve";
import { useLiveChart } from "@/components/analytics/Charts";
import { ReportChapter } from "@/components/reports/story/ReportChapter";
import { money, num } from "@/lib/format";

export function ReportRiskSection({ risk, currency }: { risk: Record<string, unknown>; currency: string }) {
  const { C } = useLiveChart();
  const analytics = risk.analytics as Record<string, unknown> | undefined;
  const qd = risk.quant_drawdown as {
    currency?: {
      underwater_curve?: { at: string; drawdown: string; drawdown_pct?: string; equity?: string; peak?: string }[];
      max_drawdown?: string;
      current_drawdown?: string;
    };
  } | undefined;
  const policy = risk.policy as { categories?: { category: string; n: number }[] } | undefined;
  const utilization = risk.utilization as
    | {
        personal_daily?: { used?: string; limit?: string; pct?: string | null };
        personal_drawdown?: { used?: string; limit?: string; pct?: string | null };
        status?: string;
      }
    | undefined;

  const underwater = (qd?.currency?.underwater_curve ?? []).map((p) => ({
    at: p.at,
    drawdown: String(p.drawdown),
    drawdown_pct: String(p.drawdown_pct ?? "0"),
    equity: String(p.equity ?? "0"),
    peak: String(p.peak ?? "0"),
  }));
  const violations = policy?.categories?.find((c) => c.category === "POLICY_VIOLATION")?.n ?? 0;
  const maxDd = qd?.currency?.max_drawdown;

  const takeaway =
    violations > 0
      ? `Policy violations on ${violations} trade(s). Max drawdown ${maxDd != null ? money(maxDd, currency) : "—"}.`
      : `Within policy for this sample. Max drawdown ${maxDd != null ? money(maxDd, currency) : "—"}.`;

  const riskHist = analytics?.distribution as { risk_amount?: { buckets?: { label: string; n: number }[] } } | undefined;
  const buckets = riskHist?.risk_amount?.buckets ?? [];
  const histOpt = buckets.length
    ? {
        grid: { left: 44, right: 16, top: 16, bottom: 48 },
        xAxis: { type: "category", data: buckets.map((b) => b.label), axisLabel: { rotate: 25, fontSize: 10 } },
        yAxis: { type: "value", name: "Trades", splitLine: { lineStyle: { color: C.line } } },
        series: [{ type: "bar", data: buckets.map((b) => b.n), itemStyle: { color: C.muted } }],
      }
    : null;

  return (
    <ReportChapter id="risk" title="3. Risk" question="How much danger did I take?" takeaway={takeaway}>
      <div className={`policy ${violations > 0 ? "bad" : "ok"}`}>
        {violations > 0 ? `Policy violations detected (${violations} trades)` : "Within policy — no material violations in sample"}
      </div>

      {(utilization?.personal_daily || utilization?.personal_drawdown) && (
        <div className="budget">
          {utilization.personal_daily && (
            <p>
              Daily loss used {money(utilization.personal_daily.used ?? "0", currency)}
              {utilization.personal_daily.limit ? ` / ${money(utilization.personal_daily.limit, currency)}` : ""}
              {utilization.personal_daily.pct != null ? ` (${num(utilization.personal_daily.pct, 0)}%)` : ""}
            </p>
          )}
          {utilization.personal_drawdown && (
            <p>
              Drawdown used {money(utilization.personal_drawdown.used ?? "0", currency)}
              {utilization.personal_drawdown.limit ? ` / ${money(utilization.personal_drawdown.limit, currency)}` : ""}
              {utilization.personal_drawdown.pct != null ? ` (${num(utilization.personal_drawdown.pct, 0)}%)` : ""}
            </p>
          )}
        </div>
      )}

      {underwater.length > 1 && (
        <ChartCard title="Underwater equity" question="How deep below peak equity?" interactive={false}>
          <UnderwaterCurve curve={underwater} currency={currency} showRangeControls={false} />
        </ChartCard>
      )}
      {histOpt && (
        <ChartCard title="Risk per trade distribution" question="How was risk sized across trades?">
          <InteractiveChart option={histOpt} size="compact" showHint={false} ariaLabel="Risk per trade histogram" />
        </ChartCard>
      )}
      <style jsx>{`
        .policy {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
        }
        .policy.ok {
          border: 1px solid var(--pos);
          background: color-mix(in srgb, var(--pos) 8%, transparent);
        }
        .policy.bad {
          border: 1px solid var(--neg);
          background: color-mix(in srgb, var(--neg) 8%, transparent);
        }
        .budget {
          margin-bottom: 14px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .budget p {
          margin: 0 0 4px;
        }
      `}</style>
    </ReportChapter>
  );
}
