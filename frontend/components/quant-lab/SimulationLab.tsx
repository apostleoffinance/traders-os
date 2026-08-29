"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { buildAnalyticsQuery, type FilterState } from "@/lib/analytics";
import type { MonteCarloResult, QuantLabPayload, RiskOfRuinResult } from "@/lib/quant";
import { Panel, Stat } from "@/components/ui";
import { Empty, useLiveChart } from "@/components/analytics/Charts";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { QuantStudyFooter } from "@/components/quant-lab/primitives/QuantStudyFooter";
import { getQuantStudy } from "@/lib/analytics/quant-studies";
import { num, signed } from "@/lib/format";

type Props = {
  accountId: string;
  filters: FilterState;
  data: QuantLabPayload;
  startingBalance: string;
};

export function SimulationLab({ accountId, filters, data, startingBalance }: Props) {
  const sim = data.simulation;
  const chart = useLiveChart();
  const query = buildAnalyticsQuery(accountId, filters);

  const [mcSims, setMcSims] = useState(sim.default_config.simulations);
  const [mcFuture, setMcFuture] = useState(sim.default_config.future_trades);
  const [mcUnit, setMcUnit] = useState(sim.default_config.unit);
  const [mcThreshold, setMcThreshold] = useState(sim.default_config.drawdown_threshold);
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [mcLoading, setMcLoading] = useState(false);
  const [mcError, setMcError] = useState<string | null>(null);

  const [equity, setEquity] = useState(startingBalance);
  const [riskPct, setRiskPct] = useState("1");
  const [ruinPct, setRuinPct] = useState("20");
  const [ruinResult, setRuinResult] = useState<RiskOfRuinResult | null>(null);
  const [ruinLoading, setRuinLoading] = useState(false);
  const [ruinError, setRuinError] = useState<string | null>(null);

  async function runMonteCarlo() {
    setMcLoading(true);
    setMcError(null);
    try {
      const res = await api<{ monte_carlo: MonteCarloResult }>(`/api/quant-lab/monte-carlo?${query}`, {
        method: "POST",
        body: JSON.stringify({
          simulations: mcSims,
          future_trades: mcFuture,
          unit: mcUnit,
          drawdown_threshold: mcThreshold ? Number(mcThreshold) : null,
          seed: 42,
        }),
      });
      setMcResult(res.monte_carlo);
    } catch (e) {
      setMcError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setMcLoading(false);
    }
  }

  async function runRiskOfRuin() {
    setRuinLoading(true);
    setRuinError(null);
    try {
      const res = await api<{ risk_of_ruin: RiskOfRuinResult }>(`/api/quant-lab/risk-of-ruin?${query}`, {
        method: "POST",
        body: JSON.stringify({
          account_equity: Number(equity),
          risk_per_trade_pct: Number(riskPct),
          ruin_drawdown_pct: Number(ruinPct),
          simulations: 10000,
          future_trades: 200,
          seed: 42,
        }),
      });
      setRuinResult(res.risk_of_ruin);
    } catch (e) {
      setRuinError(e instanceof Error ? e.message : "Risk estimate failed");
    } finally {
      setRuinLoading(false);
    }
  }

  const fanOption =
    mcResult?.sample_paths && mcResult.sample_paths.length > 0
      ? {
          ...chart,
          grid: { left: 48, right: 16, top: 24, bottom: 32 },
          tooltip: { trigger: "axis" as const },
          xAxis: { type: "category" as const, data: mcResult.sample_paths[0].cumulative.map((_, i) => String(i)) },
          yAxis: { type: "value" as const, name: mcResult.config?.unit === "R" ? "Cumulative R" : "Cumulative" },
          series: mcResult.sample_paths.slice(0, 12).map((p, idx) => ({
            type: "line" as const,
            data: p.cumulative.map((v) => Number(v)),
            showSymbol: false,
            lineStyle: { width: 1, opacity: 0.45 },
            name: `Path ${idx + 1}`,
          })),
        }
      : null;

  const mcDef = getQuantStudy("monte_carlo");
  const rorDef = getQuantStudy("risk_of_ruin");

  if (!sim.can_run) {
    return (
      <Panel title={mcDef?.title ?? "Monte Carlo"}>
        <Empty>At least 5 valid observations are required to run simulations on the filtered sample.</Empty>
        <QuantStudyFooter studyId="monte_carlo" />
      </Panel>
    );
  }

  return (
    <div className="stack">
      <Panel title={`${mcDef?.title ?? "Monte Carlo"} · simulated scenarios`}>
        <p className="muted">
          Historical sample: {sim.historical_sample_size} trades. Resamples with replacement to explore possible return sequences.
        </p>
        <div className="config">
          <label>
            Simulation runs
            <select value={mcSims} onChange={(e) => setMcSims(Number(e.target.value))}>
              {sim.allowed_simulations.map((n) => (
                <option key={n} value={n}>
                  {n.toLocaleString()}
                </option>
              ))}
            </select>
          </label>
          <label>
            Future trades
            <select value={mcFuture} onChange={(e) => setMcFuture(Number(e.target.value))}>
              {sim.allowed_future_trades.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unit
            <select value={mcUnit} onChange={(e) => setMcUnit(e.target.value)}>
              <option value="R">R</option>
              <option value="currency">Currency</option>
            </select>
          </label>
          <label>
            DD threshold ({mcUnit === "R" ? "R" : "ccy"})
            <input type="number" min="0" step="0.1" value={mcThreshold} onChange={(e) => setMcThreshold(e.target.value)} />
          </label>
          <button type="button" className="run" onClick={() => void runMonteCarlo()} disabled={mcLoading}>
            {mcLoading ? "Running…" : "Run simulation"}
          </button>
        </div>
        {mcError && <p className="error">{mcError}</p>}
        {mcResult?.available && (
          <>
            <div className="kpis">
              <Stat label="Median ending" value={mcResult.ending_return?.median ? `${signed(mcResult.ending_return.median)}${mcUnit === "R" ? "R" : ""}` : "—"} />
              <Stat label="5th percentile" value={mcResult.ending_return?.p5 ? `${signed(mcResult.ending_return.p5)}${mcUnit === "R" ? "R" : ""}` : "—"} tone="neg" />
              <Stat label="95th percentile" value={mcResult.ending_return?.p95 ? `${signed(mcResult.ending_return.p95)}${mcUnit === "R" ? "R" : ""}` : "—"} tone="pos" />
              <Stat label="Median max DD" value={mcResult.max_drawdown?.median ? `${num(mcResult.max_drawdown.median)}${mcUnit === "R" ? "R" : ""}` : "—"} tone="neg" />
              <Stat label="95th max DD" value={mcResult.max_drawdown?.p95 ? `${num(mcResult.max_drawdown.p95)}${mcUnit === "R" ? "R" : ""}` : "—"} tone="neg" />
              <Stat label="P(positive end)" value={mcResult.probabilities?.positive_ending_return ? `${num(mcResult.probabilities.positive_ending_return, 1)}%` : "—"} />
            </div>

            <ChartCard title="Drawdown scenarios" subtitle="Simulated drawdown percentiles at risk">
              <div className="kpis">
                <Stat label="50th percentile" value={mcResult.drawdown_at_risk?.p50 ? `${num(mcResult.drawdown_at_risk.p50)}${mcUnit === "R" ? "R" : ""}` : "—"} />
                <Stat label="75th percentile" value={mcResult.drawdown_at_risk?.p75 ? `${num(mcResult.drawdown_at_risk.p75)}${mcUnit === "R" ? "R" : ""}` : "—"} />
                <Stat label="90th percentile" value={mcResult.drawdown_at_risk?.p90 ? `${num(mcResult.drawdown_at_risk.p90)}${mcUnit === "R" ? "R" : ""}` : "—"} />
                <Stat label="95th percentile" value={mcResult.drawdown_at_risk?.p95 ? `${num(mcResult.drawdown_at_risk.p95)}${mcUnit === "R" ? "R" : ""}` : "—"} />
              </div>
              {mcResult.probabilities?.exceeding_drawdown_threshold != null && (
                <p className="muted">
                  Probability of exceeding {mcThreshold}
                  {mcUnit === "R" ? "R" : ""} drawdown: {num(mcResult.probabilities.exceeding_drawdown_threshold, 1)}%
                </p>
              )}
            </ChartCard>

            {fanOption && (
              <ChartCard title="Sample equity paths" subtitle="Simulated paths from historical trade distribution">
                <InteractiveChart option={fanOption} height={280} showHint={false} />
              </ChartCard>
            )}

            {mcResult.assumptions && (
              <ul className="assumptions">
                {mcResult.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            )}
            <p className="muted">{mcResult.disclaimer}</p>
            <QuantStudyFooter
              studyId="monte_carlo"
              extraAssumptions={mcResult.assumptions}
            />
          </>
        )}
        {!mcResult?.available && <QuantStudyFooter studyId="monte_carlo" />}
      </Panel>

      <Panel title={`${rorDef?.title ?? "Risk of ruin"} · model estimate`}>
        <div className="config">
          <label>
            Account equity
            <input type="number" min="0" value={equity} onChange={(e) => setEquity(e.target.value)} />
          </label>
          <label>
            Risk per trade (%)
            <input type="number" min="0" step="0.01" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} />
          </label>
          <label>
            Ruin threshold (% DD)
            <input type="number" min="0" max="100" value={ruinPct} onChange={(e) => setRuinPct(e.target.value)} />
          </label>
          <button type="button" className="run" onClick={() => void runRiskOfRuin()} disabled={ruinLoading}>
            {ruinLoading ? "Estimating…" : "Estimate risk"}
          </button>
        </div>
        {ruinError && <p className="error">{ruinError}</p>}
        {ruinResult?.available && (
          <>
            <div className="kpis" style={{ marginTop: 16 }}>
              <Stat label="Estimated probability" value={ruinResult.estimated_probability_pct ? `${num(ruinResult.estimated_probability_pct, 2)}%` : "—"} tone="neg" />
              <Stat label="Simulations" value={String(ruinResult.assumptions?.simulations ?? "—")} />
              <Stat label="Crossings" value={String(ruinResult.crossings ?? "—")} />
            </div>
            <p className="muted">{ruinResult.disclaimer}</p>
            <QuantStudyFooter studyId="risk_of_ruin" />
          </>
        )}
        {!ruinResult?.available && <QuantStudyFooter studyId="risk_of_ruin" />}
      </Panel>

      <style jsx>{`
        .stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .config {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 16px;
          align-items: flex-end;
          margin: 14px 0;
        }
        label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: var(--muted);
        }
        select,
        input {
          padding: 6px 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface);
          color: var(--text);
          font-size: 14px;
        }
        .run {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          background: var(--accent);
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }
        .run:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .muted {
          font-size: 13px;
          color: var(--muted);
          margin-top: 10px;
        }
        .error {
          color: var(--danger);
          font-size: 13px;
        }
        .assumptions {
          margin: 12px 0 0;
          padding-left: 18px;
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
