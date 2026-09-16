"use client";

import { ChartCard, MetricCard } from "@/components/trader";
import type { AnalyticsDashboard } from "@/lib/analytics";
import type { IntelligenceLab } from "@/components/intelligence/Phase3Intelligence";
import { signed } from "@/lib/format";

/**
 * Essential behaviour signals — explainable metrics only (no opaque psych scores).
 */
export function BehaviourSignals({
  data,
  intel,
}: {
  data: AnalyticsDashboard;
  intel?: IntelligenceLab | null;
}) {
  const revenge = intel?.behaviour?.revenge_trading;
  const overtrading = intel?.behaviour?.overtrading;
  const after = data.after_losses;

  const escalation =
    revenge?.risk_multiplier_after_loss_pct != null
      ? Number(revenge.risk_multiplier_after_loss_pct)
      : null;

  return (
    <section className="signals">
      <h3 className="title">Behaviour signals</h3>
      <p className="lead">Observable patterns from your journal — each card cites how it was measured.</p>

      <div className="grid">
        <ChartCard
          title="Overtrading"
          question="Am I taking too many trades in a day?"
          tier="essential"
          subtitle={
            overtrading
              ? `Normal pace ≈ ${overtrading.normal_trades_per_day ?? "—"} trades/day · max observed ${overtrading.max_trades_in_day}`
              : "Needs intelligence sample from tagged closed trades."
          }
        >
          {overtrading ? (
            <MetricCard
              label="Status"
              value={String(overtrading.status).replace(/_/g, " ")}
              hint="Compared to your typical daily trade count"
            />
          ) : (
            <p className="muted">Close more trades to estimate your normal daily pace.</p>
          )}
        </ChartCard>

        <ChartCard
          title="Risk after losses"
          question="Do I increase size after losing trades?"
          tier="essential"
          subtitle={revenge?.disclaimer ?? "Average risk after a loss vs baseline risk on the filtered sample."}
        >
          {revenge ? (
            <div className="mini">
              <MetricCard label="Baseline risk" value={revenge.baseline_risk ?? "—"} />
              <MetricCard
                label="After a loss"
                value={revenge.average_risk_after_loss ?? "—"}
                tone={escalation != null && escalation > 5 ? "neg" : undefined}
              />
              <MetricCard
                label="Change"
                value={
                  revenge.risk_multiplier_after_loss_pct != null
                    ? `${signed(revenge.risk_multiplier_after_loss_pct)}%`
                    : "—"
                }
                tone={escalation != null && escalation > 5 ? "neg" : escalation != null && escalation < -5 ? "pos" : undefined}
              />
            </div>
          ) : (
            <p className="muted">Risk fields on trades are required for this signal.</p>
          )}
        </ChartCard>

        <ChartCard
          title="After consecutive losses"
          question="Do I perform differently after a losing streak?"
          tier="essential"
          sampleSize={after?.n}
          subtitle={
            after && after.n > 0
              ? `Trades taken after ${after.threshold ?? 2}+ consecutive losses`
              : "No streak-follow-on trades in this sample."
          }
        >
          {after && after.n > 0 ? (
            <>
              <div className="mini">
                <MetricCard label="Trades" value={String(after.n)} />
                <MetricCard
                  label="Expectancy"
                  value={after.expectancy_r ? `${after.expectancy_r}R` : "—"}
                  tone={
                    after.expectancy_r && Number(after.expectancy_r) > 0
                      ? "pos"
                      : after.expectancy_r && Number(after.expectancy_r) < 0
                        ? "neg"
                        : undefined
                  }
                />
              </div>
              {after.insight ? <p className="muted">{after.insight}</p> : null}
            </>
          ) : (
            <p className="muted">No sequence of 2+ losses followed by another trade in this filter yet.</p>
          )}
        </ChartCard>
      </div>

      <style jsx>{`
        .signals {
          margin-bottom: 8px;
        }
        .title {
          margin: 0 0 4px;
          font-size: 14px;
          font-weight: 600;
        }
        .lead {
          margin: 0 0 12px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 10px;
        }
        .mini {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 10px;
        }
        .muted {
          margin: 8px 0 0;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
        }
      `}</style>
    </section>
  );
}
