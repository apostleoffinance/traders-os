"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { buildAnalyticsQuery, type FilterState } from "@/lib/analytics";
import { Panel } from "@/components/ui";

type ExperimentResponse = {
  experiment_id: string;
  dataset_fingerprint: string;
  data_quality: { valid_quant_trades: number; excluded_trades: number };
  recorded_costs: { commission_and_swap_absolute_total: string };
  cost_sensitivity: Array<{
    additional_cost_per_trade: string;
    sample_size: number;
    net_pnl: string;
    expectancy_r: string | null;
    in_sample: { n: number; expectancy_r: string | null };
    out_of_sample: { n: number; expectancy_r: string | null };
  }>;
  methodology: { not_modeled: string[] };
  disclaimer: string;
};

export function StrategyExperimentPanel({
  accountId,
  filters,
}: {
  accountId: string;
  filters: FilterState;
}) {
  const [extraCost, setExtraCost] = useState("0");
  const [splitRatio, setSplitRatio] = useState("0.7");
  const [experiment, setExperiment] = useState<ExperimentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runExperiment() {
    const cost = Number(extraCost);
    const split = Number(splitRatio);
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(split) || split < 0.5 || split >= 0.9) {
      setError("Use a non-negative added cost per trade and an in-sample split from 0.5 up to (but not including) 0.9.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = buildAnalyticsQuery(accountId, filters);
      const response = await api<ExperimentResponse>("/api/quant-lab/experiment?" + query, {
        method: "POST",
        body: JSON.stringify({ split_ratio: split, additional_cost_per_trade: String(cost) }),
      });
      setExperiment(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run this research experiment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel title="Historical cohort experiment">
      <p className="muted">
        Re-evaluate the selected historical cohort with a chronological in-sample / out-of-sample split and explicit additional-cost stress.
        This does not replay changed entry, stop-loss or take-profit rules against candles.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: 10, margin: "12px 0" }}>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>
          In-sample share
          <input aria-label="In-sample share" type="number" min="0.5" max="0.89" step="0.05" value={splitRatio} onChange={(event) => setSplitRatio(event.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>
          Additional cost per trade (account currency)
          <input aria-label="Additional cost per trade" type="number" min="0" step="0.01" value={extraCost} onChange={(event) => setExtraCost(event.target.value)} />
        </label>
        <button type="button" onClick={runExperiment} disabled={loading}>
          {loading ? "Running experiment…" : "Run experiment"}
        </button>
      </div>
      {error && <p role="alert" style={{ color: "var(--danger, #d14343)", fontSize: 12 }}>{error}</p>}
      {experiment && (
        <div style={{ display: "grid", gap: 10 }}>
          <p className="muted">
            Experiment {experiment.experiment_id} · dataset {experiment.dataset_fingerprint.slice(0, 12)}… · {experiment.data_quality.valid_quant_trades} valid trades
          </p>
          <p className="muted">{experiment.disclaimer}</p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 8 }}>Added cost / trade</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Net P&amp;L</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Expectancy (R)</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Train expectancy</th>
                  <th style={{ textAlign: "left", padding: 8 }}>Test expectancy</th>
                </tr>
              </thead>
              <tbody>
                {experiment.cost_sensitivity.map((scenario) => (
                  <tr key={scenario.additional_cost_per_trade}>
                    <td style={{ padding: 8 }}>{scenario.additional_cost_per_trade}</td>
                    <td style={{ padding: 8 }}>{scenario.net_pnl}</td>
                    <td style={{ padding: 8 }}>{scenario.expectancy_r ?? "—"}</td>
                    <td style={{ padding: 8 }}>{scenario.in_sample.expectancy_r ?? "—"} ({scenario.in_sample.n})</td>
                    <td style={{ padding: 8 }}>{scenario.out_of_sample.expectancy_r ?? "—"} ({scenario.out_of_sample.n})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">Recorded commission and swap absolute total: {experiment.recorded_costs.commission_and_swap_absolute_total}. Existing net P&amp;L already includes recorded costs; stress costs are additional.</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.5 }}>
            {experiment.methodology.not_modeled.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>
      )}
    </Panel>
  );
}
