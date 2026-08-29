"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { UnderwaterChart } from "@/components/analytics/primitives/EquityInteractive";
import { useLiveChart } from "@/components/analytics/Charts";
import { money, num } from "@/lib/format";

export function ReportRiskSection({ risk, currency }: { risk: Record<string, unknown>; currency: string }) {
  const { C } = useLiveChart();
  const analytics = risk.analytics as Record<string, unknown> | undefined;
  const qd = risk.quant_drawdown as { currency?: { underwater_curve?: { at: string; drawdown: string }[] }; currency_block?: Record<string, string> } | undefined;
  const policy = risk.policy as { categories?: { category: string; n: number }[] } | undefined;

  const underwater = (qd?.currency?.underwater_curve ?? []).map((p) => ({
    at: p.at,
    drawdown: String(p.drawdown),
    drawdown_pct: String((p as { drawdown_pct?: string }).drawdown_pct ?? "0"),
    equity: String((p as { equity?: string }).equity ?? "0"),
    peak: String((p as { peak?: string }).peak ?? "0"),
  }));
  const violations = policy?.categories?.find((c) => c.category === "POLICY_VIOLATION")?.n ?? 0;

  const riskHist = analytics?.distribution as { risk_amount?: { buckets?: { label: string; n: number }[] } } | undefined;
  const buckets = riskHist?.risk_amount?.buckets ?? [];
  const histOpt = buckets.length
    ? {
        grid: { left: 44, right: 16, top: 16, bottom: 48 },
        xAxis: { type: "category", data: buckets.map((b) => b.label), axisLabel: { rotate: 25, fontSize: 10 } },
        yAxis: { type: "value", name: "Trades", splitLine: { lineStyle: { color: C.line } } },
        series: [{ type: "bar", data: buckets.map((b) => b.n), itemStyle: { color: C.blue } }],
      }
    : null;

  return (
    <>
      <h2 className="section-title">Risk & capital preservation</h2>
      <div className={`policy ${violations > 0 ? "bad" : "ok"}`}>
        {violations > 0 ? `Policy violations detected (${violations} trades)` : "Within policy — no material violations in sample"}
      </div>
      {underwater.length > 1 && (
        <ChartCard title="Drawdown curve" interactive>
          <UnderwaterChart curve={underwater} currency={currency} />
        </ChartCard>
      )}
      {histOpt && (
        <ChartCard title="Risk per trade distribution">
          <InteractiveChart option={histOpt} height={220} showHint={false} />
        </ChartCard>
      )}
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 16px;
        }
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
      `}</style>
    </>
  );
}
