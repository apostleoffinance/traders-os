"use client";

import { useState } from "react";
import { Panel, Stat, KpiGrid } from "@/components/ui";
import { Empty, useLiveChart } from "@/components/analytics/Charts";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import type { QuantLabPayload } from "@/lib/quant";
import { EVIDENCE_LABELS, EVIDENCE_SHORT_LABELS } from "@/lib/quant";
import { getQuantStudy } from "@/lib/analytics/quant-studies";
import { QuantStudyFooter } from "@/components/quant-lab/primitives/QuantStudyFooter";
import { colorForBinRange } from "@/lib/chart-colors";
import { num, signed, tone } from "@/lib/format";

const CHART_GRID = { left: 52, right: 20, top: 32, bottom: 44 } as const;

function monteCarloLabel(status: string): { value: string; hint?: string } {
  if (status === "AWAITING_RUN") return { value: "Ready", hint: "Run simulation in Simulation tab" };
  return { value: status.replace(/_/g, " ") };
}

function EvidenceBadge({ sample }: { sample: { evidence_level: string; sample_size: number; message: string } }) {
  const n = sample.sample_size;
  return (
    <span className="evidence-badge" title={sample.message}>
      {EVIDENCE_LABELS[sample.evidence_level as keyof typeof EVIDENCE_LABELS] ?? sample.evidence_level} · {n} trade
      {n === 1 ? "" : "s"}
    </span>
  );
}

export function DataQualityStrip({ dq, meta }: { dq: QuantLabPayload["overview"]["data_quality"]; meta: QuantLabPayload["meta"] }) {
  return (
    <div className="dq-strip">
      <span className="dq-label">Data quality</span>
      <span>
        {dq.valid_quant_trades} of {dq.total_trades} closed trades used for analysis
        {dq.excluded_trades > 0 && ` · ${dq.excluded_trades} excluded`}
      </span>
      <span className="muted">
        Filtered: {meta.filtered_trades} · Account: {meta.account_name ?? "—"}
      </span>
      <style jsx>{`
        .dq-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 20px;
          align-items: center;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 8px;
          font-size: 13px;
          margin-bottom: 16px;
        }
        .dq-label {
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-size: 11px;
          color: var(--muted);
        }
        .muted {
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}

export function QuantOverviewPanel({ data }: { data: QuantLabPayload }) {
  const ov = data.overview;
  const es = ov.edge_status;
  const exp = ov.expectancy_summary;
  const n = exp.n;

  if (n === 0) {
    return (
      <Panel title="Quant Lab needs more data">
        <Empty>
          You currently have {data.meta.filtered_trades} closed trades in this filter, but none passed data validation.
          Advanced statistical analysis becomes more useful with a larger sample.
        </Empty>
      </Panel>
    );
  }

  const mc = monteCarloLabel(es.monte_carlo_status);
  const evidenceLevel = ov.sample_policy.evidence_level as keyof typeof EVIDENCE_SHORT_LABELS;

  return (
    <Panel title="Edge overview" right={<EvidenceBadge sample={ov.sample_policy} />}>
      <KpiGrid>
        <Stat
          label="Observed expectancy"
          value={es.observed_expectancy_r ? `${signed(es.observed_expectancy_r)}R` : exp.expectancy_currency ?? "—"}
          tone={tone(es.observed_expectancy_r ?? exp.expectancy_currency ?? "0")}
          hint="OBSERVED"
        />
        <Stat
          label="Recent expectancy"
          value={es.recent_expectancy_r ? `${signed(es.recent_expectancy_r)}R` : "—"}
          tone={tone(es.recent_expectancy_r ?? "0")}
          hint="Last 30 trades"
        />
        <Stat label="Sample size" value={String(n)} size="compact" hint={`${n} trade${n === 1 ? "" : "s"}`} />
        <Stat
          label="Evidence level"
          size="label"
          value={EVIDENCE_SHORT_LABELS[evidenceLevel] ?? evidenceLevel}
          hint={EVIDENCE_LABELS[evidenceLevel]}
        />
        <Stat label="Max drawdown" value={es.max_drawdown_r ? `${num(es.max_drawdown_r)}R` : es.max_drawdown_currency ?? "—"} tone="neg" />
        <Stat
          label="Outlier dependency"
          value={es.outlier_dependency_pct ? `${num(es.outlier_dependency_pct, 1)}%` : "—"}
          hint={es.outlier_dependency_level ?? undefined}
        />
        <Stat label="Monte Carlo" size="label" value={mc.value} hint={mc.hint} />
      </KpiGrid>
      <p className="muted">{ov.sample_policy.message}</p>
      <style jsx>{`
        .muted {
          margin-top: 12px;
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </Panel>
  );
}

export function ExpectancyEnginePanel({ data }: { data: QuantLabPayload }) {
  const exp = data.edge.expectancy;
  const pay = data.edge.payoff;
  const ci = data.edge.win_rate_ci;
  const boot = data.edge.bootstrap_expectancy_r;

  if (exp.n === 0) return null;

  return (
    <>
      <Panel title="Expectancy engine" right={<EvidenceBadge sample={exp.sample} />}>
        <KpiGrid>
          <Stat label="Win rate" value={exp.win_rate ? `${num(exp.win_rate, 1)}%` : "—"} />
          <Stat label="Average win" value={exp.average_win ?? "—"} tone="pos" />
          <Stat label="Average loss" value={exp.average_loss ?? "—"} tone="neg" />
          <Stat
            label="Payoff ratio"
            value={pay.payoff_ratio_r ? num(pay.payoff_ratio_r) : "—"}
            hint={pay.payoff_ratio_r ? undefined : pay.note ?? "Not available for this sample"}
          />
          <Stat label="Expectancy R" value={exp.expectancy_r ? `${signed(exp.expectancy_r)}R` : "—"} tone={tone(exp.expectancy_r ?? "0")} />
        </KpiGrid>
      </Panel>

      <Panel title="Win rate confidence · Wilson score interval">
        {ci.available ? (
          <>
            <KpiGrid>
              <Stat label="Observed" value={ci.observed ? `${num(ci.observed, 1)}%` : "—"} />
              <Stat
                label={`${Math.round((ci.confidence_level ?? 0.95) * 100)}% interval`}
                size="compact"
                value={ci.lower_bound && ci.upper_bound ? `${num(ci.lower_bound, 1)}% — ${num(ci.upper_bound, 1)}%` : "—"}
              />
            </KpiGrid>
            <p className="muted">{ci.note}</p>
            <QuantStudyFooter studyId="win_rate_ci" />
          </>
        ) : (
          <Empty>Insufficient data for confidence interval.</Empty>
        )}
      </Panel>

      <ChartCard
        title={getQuantStudy("bootstrap_expectancy")?.title ?? "Bootstrap expectancy R"}
        question={getQuantStudy("bootstrap_expectancy")?.primaryQuestion}
        tier="quant"
        interactive
      >
        {boot.available ? (
          <>
            <KpiGrid>
              <Stat label="Observed" value={boot.point_estimate ? `${signed(boot.point_estimate)}R` : "—"} hint="point" />
              <Stat label="Bootstrap median" value={boot.median ? `${signed(boot.median)}R` : "—"} />
              <Stat
                label="95% range"
                size="compact"
                value={
                  boot.confidence_interval.lower && boot.confidence_interval.upper
                    ? `${signed(boot.confidence_interval.lower)}R → ${signed(boot.confidence_interval.upper)}R`
                    : "—"
                }
              />
            </KpiGrid>
            {boot.histogram && boot.histogram.length > 0 && (
              <BootstrapHistogramChart
                histogram={boot.histogram}
                observed={boot.point_estimate}
                ci={boot.confidence_interval}
              />
            )}
          </>
        ) : (
          <Empty>{boot.note ?? "Need at least 2 valid R observations."}</Empty>
        )}
        {boot.note && boot.available && <p className="muted">{boot.note}</p>}
        <QuantStudyFooter studyId="bootstrap_expectancy" sample={exp.sample} />
      </ChartCard>

      <Panel title={`Edge stability · ${data.edge.edge_stability.label}`}>
        <KpiGrid>
          <Stat
            label="Historical expectancy R"
            value={
              data.edge.edge_stability.historical.expectancy_r
                ? `${signed(String(data.edge.edge_stability.historical.expectancy_r))}R`
                : "—"
            }
          />
          <Stat
            label={`Recent (${data.edge.edge_stability.recent_window})`}
            value={
              data.edge.edge_stability.recent.expectancy_r
                ? `${signed(String(data.edge.edge_stability.recent.expectancy_r))}R`
                : "—"
            }
          />
          <Stat
            label="Change"
            value={
              data.edge.edge_stability.differences.expectancy_r?.percentage
                ? `${num(String(data.edge.edge_stability.differences.expectancy_r.percentage), 1)}%`
                : "—"
            }
          />
        </KpiGrid>
        <p className="muted">{data.edge.edge_stability.disclaimer}</p>
        <QuantStudyFooter studyId="edge_stability" sample={exp.sample} />
      </Panel>

      <style jsx>{`
        .muted {
          margin-top: 12px;
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </>
  );
}

export function DrawdownPanel({ data }: { data: QuantLabPayload }) {
  const dd = data.drawdown;
  const chart = useLiveChart();
  const curve = dd.currency.underwater_curve;

  const option =
    curve.length > 1
      ? {
          ...chart,
          grid: CHART_GRID,
          tooltip: { trigger: "axis" as const },
          xAxis: { type: "category" as const, data: curve.map((p) => p.at.slice(0, 10)), axisLabel: { fontSize: 10 } },
          yAxis: { type: "value" as const, name: "Drawdown" },
          series: [
            {
              type: "line" as const,
              data: curve.map((p) => Number(p.drawdown)),
              areaStyle: { color: "rgba(239, 68, 68, 0.15)" },
              lineStyle: { color: "#ef4444", width: 1.5 },
              showSymbol: false,
            },
          ],
        }
      : null;

  const ddDef = getQuantStudy("drawdown_research");

  return (
    <>
      <Panel title={ddDef?.title ?? "Maximum drawdown"}>
        <KpiGrid>
          <Stat label="Max DD (currency)" value={dd.currency.max_drawdown ?? "—"} tone="neg" />
          <Stat label="Max DD (R)" value={dd.r_multiple.max_drawdown_r ? `${num(dd.r_multiple.max_drawdown_r)}R` : "—"} tone="neg" />
          <Stat label="Current DD" value={dd.currency.current_drawdown ?? "—"} tone="neg" />
          <Stat label="Ulcer index" value={dd.ulcer_index.ulcer_index ? num(dd.ulcer_index.ulcer_index) : "—"} />
          <Stat
            label="Recovery factor"
            value={dd.recovery_factor_r.recovery_factor ? num(dd.recovery_factor_r.recovery_factor) : "—"}
          />
        </KpiGrid>
        {dd.ulcer_index.note && <p className="muted">{dd.ulcer_index.note}</p>}
        <QuantStudyFooter studyId="drawdown_research" sample={dd.sample} />
      </Panel>

      {option && (
        <ChartCard title="Underwater equity" subtitle="Drawdown depth over time" tier="quant" interactive>
          <InteractiveChart option={option} height={280} showHint={false} className="chart-spaced" />
        </ChartCard>
      )}

      <style jsx>{`
        .muted {
          margin-top: 12px;
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </>
  );
}

export function RollingPanel({ data }: { data: QuantLabPayload }) {
  const rolling = data.rolling;
  const chart = useLiveChart();
  const [window, setWindow] = useState(rolling.default_windows[0] ?? 20);

  const series = rolling.series[String(window)] ?? [];
  const points = series.filter((p) => p.expectancy_r != null);

  const option =
    points.length > 0
      ? {
          ...chart,
          grid: CHART_GRID,
          tooltip: {
            trigger: "axis" as const,
            formatter: (params: { dataIndex: number }[]) => {
              const i = params[0]?.dataIndex ?? 0;
              const p = points[i];
              if (!p) return "";
              return `Trade #${p.trade_number}<br/>Expectancy: ${signed(p.expectancy_r!)}R<br/>Win rate: ${p.win_rate ? num(p.win_rate, 1) + "%" : "—"}`;
            },
          },
          xAxis: { type: "category" as const, data: points.map((p) => String(p.trade_number)) },
          yAxis: { type: "value" as const, name: "Expectancy R" },
          series: [{ type: "line" as const, data: points.map((p) => Number(p.expectancy_r)), showSymbol: false, lineStyle: { width: 2 } }],
        }
      : null;

  const rollingDef = getQuantStudy("rolling_expectancy");

  return (
    <ChartCard
      title={rollingDef?.title ?? "Rolling performance"}
      question={rollingDef?.primaryQuestion}
      tier="quant"
      sampleSize={rolling.n}
      interactive
      actions={
        <div className="window-picks">
          {rolling.default_windows.map((w) => (
            <button key={w} type="button" className={w === window ? "active" : ""} onClick={() => setWindow(w)}>
              {w}
            </button>
          ))}
        </div>
      }
    >
      {option ? <InteractiveChart option={option} height={300} showHint={false} className="chart-spaced" /> : <Empty>Insufficient trades for rolling window {window}.</Empty>}
      <QuantStudyFooter studyId="rolling_expectancy" />
      <style jsx>{`
        .window-picks {
          display: flex;
          gap: 6px;
        }
        .window-picks button {
          border: 1px solid var(--border);
          background: transparent;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          cursor: pointer;
        }
        .window-picks button.active {
          border-color: var(--accent);
          color: var(--accent);
        }
      `}</style>
    </ChartCard>
  );
}

export function StreakPanel({ data }: { data: QuantLabPayload }) {
  const s = data.streaks;
  const { C } = useLiveChart();
  const dist = s.loss_streak_distribution;
  const lossOpt = {
    grid: { left: 40, right: 16, top: 28, bottom: 36 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: dist.map((d) => d.label), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", name: "Occurrences", splitLine: { lineStyle: { color: C.line } } },
    series: [{ type: "bar", data: dist.map((d) => d.occurrences), itemStyle: { color: C.neg } }],
  };

  const streakDef = getQuantStudy("loss_streak_distribution");

  return (
    <ChartCard
      title={streakDef?.title ?? "Loss streak distribution"}
      question={streakDef?.primaryQuestion}
      tier="quant"
      subtitle="Historical loss streak lengths — not a stop-trading rule."
      interactive
    >
      {dist.some((d) => d.occurrences > 0) ? (
        <InteractiveChart option={lossOpt} height={220} showHint={false} className="chart-spaced" />
      ) : (
        <Empty>No loss streaks in this sample.</Empty>
      )}
      <KpiGrid>
        <Stat label="Longest win streak" value={String(s.longest.wins)} />
        <Stat label="Longest loss streak" value={String(s.longest.losses)} />
        <Stat label="Current wins" value={String(s.current.wins)} />
        <Stat label="Current losses" value={String(s.current.losses)} />
      </KpiGrid>
      <QuantStudyFooter studyId="loss_streak_distribution" />
      <style jsx>{`
        :global(.chart-spaced) {
          margin-top: 4px;
        }
      `}</style>
    </ChartCard>
  );
}

export function DistributionPanel({ data }: { data: QuantLabPayload }) {
  const dist = data.distribution;
  const { C } = useLiveChart();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const primary = dist.primary;
  const unit = primary.unit === "R" ? "R" : "";

  const option =
    primary.histogram.length > 0
      ? {
          grid: CHART_GRID,
          tooltip: { trigger: "axis" as const },
          xAxis: {
            type: "category" as const,
            data: primary.histogram.map((b) => `${b.from}${unit}`),
            axisLabel: { fontSize: 10, rotate: 30 },
          },
          yAxis: { type: "value" as const, name: "Trades" },
          series: [
            {
              type: "bar" as const,
              data: primary.histogram.map((b) => ({
                value: b.n,
                itemStyle: { color: colorForBinRange(C, b.from, b.to) },
              })),
            },
          ],
        }
      : null;

  const distDef = getQuantStudy("return_distribution");

  if (primary.n === 0) {
    return (
      <ChartCard title={distDef?.title ?? "Return distribution"} tier="quant">
        <Empty>No valid trades for distribution analysis.</Empty>
      </ChartCard>
    );
  }

  return (
    <>
      <ChartCard
        title={distDef?.title ?? "Return distribution"}
        question={distDef?.primaryQuestion}
        tier="quant"
        sampleSize={primary.sample.sample_size}
        evidenceLabel={EVIDENCE_LABELS[primary.sample.evidence_level as keyof typeof EVIDENCE_LABELS] ?? primary.sample.evidence_level}
        interactive
      >
        <KpiGrid>
          <Stat label="Mean" value={primary.core.mean ? `${primary.core.mean}${unit}` : "—"} />
          <Stat label="Median" value={primary.core.median ? `${primary.core.median}${unit}` : "—"} />
          <Stat label="Std dev" value={primary.core.stdev ? num(primary.core.stdev) : "—"} />
          <Stat label="P25" value={primary.core.percentiles.p25 ? `${primary.core.percentiles.p25}${unit}` : "—"} />
          <Stat label="P75" value={primary.core.percentiles.p75 ? `${primary.core.percentiles.p75}${unit}` : "—"} />
        </KpiGrid>
        {option && <InteractiveChart option={option} height={260} showHint={false} className="chart-spaced" />}
        <p className="muted">{dist.note}</p>
        <QuantStudyFooter studyId="return_distribution" sample={primary.sample} />
      </ChartCard>

      <Panel title="Advanced distribution metrics">
        <button type="button" className="toggle" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? "Hide" : "Show"} advanced statistics
        </button>
        {showAdvanced && (
          <div className="advanced">
            <Stat label="Skewness" value={primary.advanced.skewness ? num(primary.advanced.skewness) : "—"} />
            <Stat label="Excess kurtosis" value={primary.advanced.excess_kurtosis ? num(primary.advanced.excess_kurtosis) : "—"} />
            {primary.advanced.skewness_interpretation?.label && (
              <p className="interp">
                <strong>{primary.advanced.skewness_interpretation.label}</strong> — {primary.advanced.skewness_interpretation.text}
              </p>
            )}
            {primary.advanced.kurtosis_interpretation?.label && (
              <p className="interp">
                <strong>{primary.advanced.kurtosis_interpretation.label}</strong> — {primary.advanced.kurtosis_interpretation.text}
              </p>
            )}
          </div>
        )}
      </Panel>

      <style jsx>{`
        .muted {
          margin-top: 12px;
          font-size: 13px;
          color: var(--muted);
        }
        .toggle {
          border: 1px solid var(--border);
          background: transparent;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 13px;
          cursor: pointer;
        }
        .advanced {
          margin-top: 14px;
          display: grid;
          gap: 10px;
        }
        .interp {
          font-size: 13px;
          color: var(--muted);
          margin: 0;
        }
      `}</style>
    </>
  );
}

export function OutlierDependencyPanel({ data }: { data: QuantLabPayload }) {
  const o = data.outliers;
  const level = o.dependency_level ?? "—";

  return (
    <Panel title="Outlier dependency" right={<EvidenceBadge sample={o.sample} />}>
      <KpiGrid>
        <Stat label="Total net profit" value={o.total_net_profit} />
        <Stat label="Top 5 contribution" value={o.contributions.top_5?.pct_of_net_profit ? `${num(o.contributions.top_5.pct_of_net_profit, 1)}%` : "—"} />
        <Stat label="Dependency level" size="label" value={level} hint="Top 5 share of net profit" />
      </KpiGrid>
      <div className="grid2">
        <Stat label="Without top 1 · expectancy R" value={o.performance_without_outliers.without_top_1?.expectancy_r ? `${signed(o.performance_without_outliers.without_top_1.expectancy_r)}R` : "—"} />
        <Stat label="Without top 3 · expectancy R" value={o.performance_without_outliers.without_top_3?.expectancy_r ? `${signed(o.performance_without_outliers.without_top_3.expectancy_r)}R` : "—"} />
        <Stat label="Without top 5 · expectancy R" value={o.performance_without_outliers.without_top_5?.expectancy_r ? `${signed(o.performance_without_outliers.without_top_5.expectancy_r)}R` : "—"} />
      </div>
      <p className="muted">{o.disclaimer}</p>
      <QuantStudyFooter studyId="outlier_dependency" sample={o.sample} />
      <style jsx>{`
        .grid2 {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
          gap: 16px 20px;
          margin-top: 16px;
        }
        .muted {
          margin-top: 12px;
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </Panel>
  );
}

export function TopTradeRemovalPanel({ data }: { data: QuantLabPayload }) {
  const rob = data.robustness.top_trade_removal;

  return (
    <Panel title={getQuantStudy("top_trade_removal")?.title ?? "Robustness test · top-trade removal"}>
      <table className="scenario-table">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>n</th>
            <th>Expectancy R</th>
            <th>Profit factor</th>
            <th>Net R</th>
          </tr>
        </thead>
        <tbody>
          {rob.scenarios.map((s) => (
            <tr key={s.label}>
              <td>{s.label}</td>
              <td>{s.n}</td>
              <td>{s.expectancy_r ? `${signed(s.expectancy_r)}R` : "—"}</td>
              <td>{s.profit_factor ? num(s.profit_factor) : "—"}</td>
              <td>{s.net_r ? `${signed(s.net_r)}R` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">{rob.disclaimer}</p>
      <QuantStudyFooter studyId="top_trade_removal" />
      <style jsx>{`
        .scenario-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th,
        td {
          text-align: left;
          padding: 8px 10px;
          border-bottom: 1px solid var(--border);
        }
        th {
          color: var(--muted);
          font-weight: 600;
          font-size: 11px;
          text-transform: uppercase;
        }
        .muted {
          margin-top: 12px;
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </Panel>
  );
}

export function BootstrapRobustnessPanel({ data }: { data: QuantLabPayload }) {
  const b = data.robustness.bootstrap;

  function row(label: string, m: typeof b.expectancy_r, suffix = "") {
    if (!m.available) {
      return (
        <div className="row">
          <span className="label">{label}</span>
          <span className="muted">Insufficient data</span>
        </div>
      );
    }
    return (
      <div className="row">
        <span className="label">{label}</span>
        <span>
          Observed {m.observed ? `${signed(m.observed)}${suffix}` : "—"} · Median {m.bootstrap_median ? `${signed(m.bootstrap_median)}${suffix}` : "—"} · 95%{" "}
          {m.confidence_interval.lower && m.confidence_interval.upper
            ? `${signed(m.confidence_interval.lower)}${suffix} → ${signed(m.confidence_interval.upper)}${suffix}`
            : "—"}
        </span>
      </div>
    );
  }

  return (
    <ChartCard
      title={getQuantStudy("bootstrap_expectancy")?.title ?? "Bootstrap robustness"}
      question="How stable are key metrics under resampling?"
      tier="quant"
      interactive
    >
      {row("Expectancy R", b.expectancy_r, "R")}
      {b.expectancy_r.histogram && b.expectancy_r.histogram.length > 0 && (
        <BootstrapHistogramChart
          histogram={b.expectancy_r.histogram}
          observed={b.expectancy_r.observed}
          ci={b.expectancy_r.confidence_interval}
        />
      )}
      {row("Average return", b.average_return)}
      {row("Win rate", b.win_rate, "%")}
      <p className="muted">{b.note}</p>
      <QuantStudyFooter studyId="bootstrap_expectancy" />
      <style jsx>{`
        .row {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
        }
        .label {
          font-weight: 600;
        }
        .muted {
          margin-top: 12px;
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </ChartCard>
  );
}

export function RobustnessLab({ data }: { data: QuantLabPayload }) {
  return (
    <div className="stack">
      <DistributionPanel data={data} />
      <OutlierDependencyPanel data={data} />
      <TopTradeRemovalPanel data={data} />
      <BootstrapRobustnessPanel data={data} />
      <style jsx>{`
        .stack {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
      `}</style>
    </div>
  );
}

function BootstrapHistogramChart({
  histogram,
  observed,
  ci,
}: {
  histogram: { from: number; to: number; n: number }[];
  observed: string | null;
  ci: { lower: string | null; upper: string | null; level: number };
}) {
  const { C } = useLiveChart();
  const option = {
    grid: { left: 52, right: 20, top: 28, bottom: 44 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: histogram.map((b) => `${num(b.from, 2)}–${num(b.to, 2)}`),
      axisLabel: { fontSize: 9, rotate: 35 },
    },
    yAxis: { type: "value", name: "Frequency", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        data: histogram.map((b) => ({
          value: b.n,
          itemStyle: { color: colorForBinRange(C, b.from, b.to) },
        })),
      },
    ],
  };

  return (
    <div className="boot-hist">
      <p className="muted">
        Bootstrap distribution · observed {observed ? `${signed(observed)}R` : "—"}
        {ci.lower && ci.upper ? ` · ${Math.round(ci.level * 100)}% CI ${signed(ci.lower)}R → ${signed(ci.upper)}R` : ""}
      </p>
      <InteractiveChart option={option} height={240} showHint={false} className="chart-spaced" />
      <style jsx>{`
        .boot-hist {
          margin-top: 16px;
        }
        .muted {
          font-size: 12px;
          color: var(--muted);
          margin: 0 0 6px;
        }
      `}</style>
    </div>
  );
}