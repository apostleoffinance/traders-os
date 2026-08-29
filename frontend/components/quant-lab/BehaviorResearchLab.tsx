"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { buildAnalyticsQuery, type FilterState } from "@/lib/analytics";
import type { DisciplineComparison, QuantLabPayload } from "@/lib/quant";
import { Panel, Stat } from "@/components/ui";
import { Empty, useLiveChart } from "@/components/analytics/Charts";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { num, signed } from "@/lib/format";

type CompareResult = {
  conditions: Record<string, unknown>;
  n: number;
  min_n_required: number;
  insufficient_sample: boolean;
  metrics: {
    n: number;
    win_rate: string | null;
    expectancy_r: string | null;
    profit_factor: string | null;
    average_r: string | null;
  } | null;
  multiple_exploration_notice: string;
};

function disciplineComparisonChart(comps: DisciplineComparison[], C: ReturnType<typeof useLiveChart>["C"]) {
  return {
    grid: { left: 44, right: 16, top: 16, bottom: 56 },
    tooltip: { trigger: "axis" },
    legend: { data: ["Segment A", "Segment B"], bottom: 0 },
    xAxis: {
      type: "category",
      data: ["Rules followed", "Non-emotional", "With confirmation"],
      axisLabel: { fontSize: 10, rotate: 12 },
    },
    yAxis: { type: "value", name: "Expectancy R", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        name: "Segment A",
        type: "bar",
        data: comps.map((c) => Number(c.group_a.expectancy_r ?? 0)),
        itemStyle: { color: C.pos },
      },
      {
        name: "Segment B",
        type: "bar",
        data: comps.map((c) => Number(c.group_b.expectancy_r ?? 0)),
        itemStyle: { color: C.neg },
      },
    ],
  };
}

export function BehaviorResearchLab({
  accountId,
  filters,
  data,
}: {
  accountId: string;
  filters: FilterState;
  data: QuantLabPayload;
}) {
  const behavior = data.behavior;
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const query = buildAnalyticsQuery(accountId, filters);
  const [setup, setSetup] = useState(behavior.setup_interactions.values.setups[0] ?? "");
  const [session, setSession] = useState("");
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);

  const comps = useMemo(
    () => [
      behavior.discipline.comparisons.rules_followed_vs_broken,
      behavior.discipline.comparisons.non_emotional_vs_emotional,
      behavior.discipline.comparisons.with_confirmation_vs_without,
    ],
    [behavior.discipline.comparisons],
  );

  const riskChart = useMemo(
    () => ({
      grid: { left: 140, right: 24, top: 16, bottom: 24 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "value", name: "Risk %", splitLine: { lineStyle: { color: C.line } } },
      yAxis: {
        type: "category",
        data: behavior.risk_escalation.patterns.map((p) => p.label),
        inverse: true,
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          type: "bar",
          data: behavior.risk_escalation.patterns.map((p) => ({
            value: Number(p.average_risk_pct ?? 0),
            itemStyle: { color: Number(p.pct_difference_from_baseline ?? 0) > 0 ? C.neg : C.blue },
          })),
        },
      ],
    }),
    [behavior.risk_escalation.patterns, C],
  );

  const positionChart = useMemo(
    () =>
      behavior.position_size.available
        ? {
            grid: { left: 44, right: 16, top: 16, bottom: 48 },
            tooltip: { trigger: "axis" },
            xAxis: {
              type: "category",
              data: behavior.position_size.buckets.map((b) => b.label),
              axisLabel: { rotate: 25, fontSize: 10 },
            },
            yAxis: { type: "value", name: "Expectancy R", splitLine: { lineStyle: { color: C.line } } },
            series: [
              {
                type: "bar",
                data: behavior.position_size.buckets.map((b) => ({
                  value: Number(b.expectancy_r ?? 0),
                  itemStyle: { color: Number(b.expectancy_r ?? 0) >= 0 ? C.pos : C.neg },
                })),
              },
            ],
          }
        : null,
    [behavior.position_size, C],
  );

  const comboRows = behavior.setup_interactions.highlighted_combinations.slice(0, 8);
  const comboChart = useMemo(
    () =>
      comboRows.length
        ? {
            grid: { left: 160, right: 40, top: 8, bottom: 24 },
            tooltip: { trigger: "axis" },
            xAxis: { type: "value", name: "Expectancy R", splitLine: { lineStyle: { color: C.line } } },
            yAxis: {
              type: "category",
              data: comboRows.map((c) => c.label),
              inverse: true,
              axisLabel: { fontSize: 10 },
            },
            series: [
              {
                type: "bar",
                data: comboRows.map((c) => ({
                  value: Number(c.metrics?.expectancy_r ?? 0),
                  itemStyle: { color: Number(c.metrics?.expectancy_r ?? 0) >= 0 ? C.pos : C.neg },
                })),
                label: { show: true, position: "right", fontSize: 10, formatter: (p: { dataIndex: number }) => `n=${comboRows[p.dataIndex].n}` },
              },
            ],
          }
        : null,
    [comboRows, C],
  );

  async function runExplore() {
    setLoading(true);
    try {
      const params = new URLSearchParams(query);
      if (setup) params.set("setup", setup);
      if (session) params.set("session", session);
      const res = await api<{ comparison: CompareResult }>(`/api/quant-lab/compare?${params.toString()}`);
      setCompareResult(res.comparison);
    } finally {
      setLoading(false);
    }
  }

  if (!behavior) {
    return (
      <Panel title="Behavior quant">
        <Empty>Behavior research is loading…</Empty>
      </Panel>
    );
  }

  return (
    <div className="stack">
      <ChartCard title="Discipline alpha · OBSERVED PERFORMANCE" interactive>
        <InteractiveChart option={disciplineComparisonChart(comps, C)} height={260} showHint={false} />
        <div className="grid">
          {comps.map((c, i) => (
            <div key={i} className="card">
              <h3>{i === 0 ? "Rules followed vs broken" : i === 1 ? "Non-emotional vs emotional" : "Confirmation status"}</h3>
              <div className="row">
                <Stat label={c.label_a} value={c.group_a.expectancy_r ? `${signed(c.group_a.expectancy_r)}R` : "—"} hint={`n=${c.group_a.n}`} />
                <Stat label={c.label_b} value={c.group_b.expectancy_r ? `${signed(c.group_b.expectancy_r)}R` : "—"} hint={`n=${c.group_b.n}`} />
                <Stat label="Difference" value={c.discipline_alpha_r ? `${signed(c.discipline_alpha_r)}R` : "—"} />
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Risk escalation research" subtitle={behavior.risk_escalation.disclaimer} interactive>
        <InteractiveChart option={riskChart} height={Math.max(180, behavior.risk_escalation.patterns.length * 32 + 48)} showHint={false} />
      </ChartCard>

      <ChartCard title="Position size research" interactive>
        {behavior.position_size.available && positionChart ? (
          <InteractiveChart option={positionChart} height={260} showHint={false} />
        ) : (
          <Empty>{behavior.position_size.reason}</Empty>
        )}
      </ChartCard>

      <ChartCard title="Setup interaction explorer" interactive>
        <p className="muted">{behavior.setup_interactions.multiple_exploration_notice}</p>
        <div className="config">
          <label>
            Setup
            <select value={setup} onChange={(e) => setSetup(e.target.value)}>
              {behavior.setup_interactions.values.setups.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Session
            <select value={session} onChange={(e) => setSession(e.target.value)}>
              <option value="">Any</option>
              {behavior.setup_interactions.values.sessions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="run" onClick={() => void runExplore()} disabled={loading}>
            {loading ? "Exploring…" : "Explore combination"}
          </button>
        </div>
        {compareResult && (
          <div className="result">
            {compareResult.insufficient_sample ? (
              <Empty>Insufficient sample (n={compareResult.n}, need {compareResult.min_n_required}).</Empty>
            ) : (
              <div className="row">
                <Stat label="Trades" value={String(compareResult.metrics?.n ?? 0)} />
                <Stat label="Expectancy R" value={compareResult.metrics?.expectancy_r ? `${signed(compareResult.metrics.expectancy_r)}R` : "—"} />
                <Stat label="Win rate" value={compareResult.metrics?.win_rate ? `${num(compareResult.metrics.win_rate, 1)}%` : "—"} />
                <Stat label="Profit factor" value={compareResult.metrics?.profit_factor ? num(compareResult.metrics.profit_factor) : "—"} />
              </div>
            )}
          </div>
        )}
        {comboChart && (
          <InteractiveChart
            option={comboChart}
            height={Math.max(200, comboRows.length * 34 + 48)}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || e.dataIndex == null) return;
              const row = comboRows[e.dataIndex];
              drill.openTrades(row.label);
            }}
          />
        )}
      </ChartCard>

      <ChartCard title="MFE / MAE research">
        {behavior.mfe_mae.available ? (
          <div className="row">
            <Stat label="Median MFE capture" value={behavior.mfe_mae.mfe_capture?.median_pct ? `${num(behavior.mfe_mae.mfe_capture.median_pct, 1)}%` : "—"} />
            <Stat label="Winners median MAE" value={behavior.mfe_mae.winning_trade_heat?.median_mae_r ? `${num(behavior.mfe_mae.winning_trade_heat.median_mae_r)}R` : "—"} />
            <Stat label="Winners 75th MAE" value={behavior.mfe_mae.winning_trade_heat?.p75_mae_r ? `${num(behavior.mfe_mae.winning_trade_heat.p75_mae_r)}R` : "—"} />
          </div>
        ) : (
          <Empty>{behavior.mfe_mae.status ?? "MFE/MAE data required"}</Empty>
        )}
      </ChartCard>

      <p className="muted">{behavior.disclaimer}</p>

      <style jsx>{`
        .stack {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .card {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 14px;
        }
        h3 {
          margin: 0 0 12px;
          font-size: 14px;
        }
        .config {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-end;
          margin-top: 12px;
        }
        label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 12px;
          color: var(--muted);
        }
        select {
          padding: 6px 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface);
        }
        .run {
          padding: 8px 14px;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: #fff;
          font-weight: 600;
          cursor: pointer;
        }
        .row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 10px;
          margin-top: 12px;
        }
        .muted {
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
