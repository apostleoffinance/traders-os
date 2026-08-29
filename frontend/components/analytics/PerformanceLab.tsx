"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Panel, Stat } from "@/components/ui";
import { Empty, EvidenceTag, useLiveChart } from "@/components/analytics/Charts";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { MetricCard } from "@/components/analytics/primitives/MetricCard";
import { MiniSparkline } from "@/components/analytics/primitives/MiniSparkline";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard, GroupRow, LabLeaderboardRow, LabTradeRank } from "@/lib/analytics";
import { formatWhen, holdingLabel, money, num, sessionLabel, signed, tone } from "@/lib/format";

type DrillMetric = "win_rate" | "expectancy_r" | "profit_factor" | "average_r";

export function PerformanceLab({
  data,
  onMetricClick,
}: {
  data: AnalyticsDashboard;
  onMetricClick?: (metric: DrillMetric) => void;
}) {
  const lab = data.lab;
  const currency = data.account.currency;
  if (!lab) {
    return (
      <Panel title="Performance">
        <Empty>Performance analytics are loading — refresh if this persists.</Empty>
      </Panel>
    );
  }

  const { kpis, win_loss: wl, direction_comparison: dc, best_trades: bt } = lab.performance;
  const n = lab.metadata.sample_size;
  const prior = data.lab?.temporal?.period_comparison;

  function periodDelta(metricLabel: string): string | null {
    if (!prior?.available) return null;
    const row = prior.comparison.find((r) => r.metric.toLowerCase().includes(metricLabel));
    return row?.change ? String(row.change) : null;
  }

  const equitySpark = useMemo(
    () => data.equity.slice(-24).map((p) => Number(p.equity)),
    [data.equity],
  );

  return (
    <>
      <Panel title="KPI scorecard" right={<EvidenceTag label={lab.performance.evidence.label} n={n} />}>
        {n === 0 ? (
          <Empty>{wl.sample_note ?? "No closed trades match the selected filters."}</Empty>
        ) : (
          <>
            <div className="hero-kpis">
              <MetricCard
                label="Net P&L"
                value={money(kpis.net_pnl.value as string, currency)}
                tone={tone(kpis.net_pnl.value as string)}
                hint={`n=${kpis.net_pnl.n}`}
                spark={<MiniSparkline values={equitySpark} />}
              />
              <MetricCard
                label="Profit factor"
                value={kpis.profit_factor.value ? num(kpis.profit_factor.value) : kpis.profit_factor.note ?? "—"}
                delta={periodDelta("profit")}
                onClick={onMetricClick ? () => onMetricClick("profit_factor") : undefined}
              />
              <MetricCard
                label="Win rate"
                value={kpis.win_rate.value ? `${num(kpis.win_rate.value, 1)}%` : "—"}
                progress={kpis.win_rate.value ? Number(kpis.win_rate.value) : undefined}
                delta={periodDelta("win")}
                onClick={onMetricClick ? () => onMetricClick("win_rate") : undefined}
              />
              <MetricCard
                label="Expectancy R"
                value={kpis.expectancy_r.value ? `${signed(kpis.expectancy_r.value)}R` : "—"}
                tone={tone(kpis.expectancy_r.value as string)}
                delta={periodDelta("expectancy")}
                onClick={onMetricClick ? () => onMetricClick("expectancy_r") : undefined}
              />
            </div>
            <div className="secondary-kpis">
              <Stat label="Gross P&L" value={money(kpis.gross_pnl.value as string, currency)} tone={tone(kpis.gross_pnl.value as string)} />
              <Stat label="Net R" value={signed(kpis.net_r.value as string, "R")} tone={tone(kpis.net_r.value as string)} />
              <Stat label="Closed trades" value={String(kpis.total_closed_trades.value)} />
              <Stat label="Avg win" value={money(kpis.average_win.value as string, currency)} tone="pos" />
              <Stat label="Avg loss" value={money(kpis.average_loss.value as string, currency)} tone="neg" />
              <Stat label="Max drawdown" value={money(kpis.max_drawdown.value as string, currency)} tone="neg" />
            </div>
            {lab.performance.sample_note && <p className="muted">{lab.performance.sample_note}</p>}
          </>
        )}
      </Panel>

      {n > 0 && <ProfitFactorExplorer data={data} wl={wl} currency={currency} onMetricClick={onMetricClick} />}
      {n > 0 && <WinLossSection wl={wl} currency={currency} rDistribution={data.r_distribution} />}
      {n > 0 && <PayoffComparison wl={wl} currency={currency} />}
      {n > 0 && <DirectionComparison dc={dc} currency={currency} />}
      {n > 0 && <RankedTradesPanel bt={bt} currency={currency} timezone={lab.metadata.timezone} />}

      <style jsx>{`
        .hero-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .secondary-kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
        }
        .muted {
          margin-top: 10px;
          font-size: 13px;
        }
      `}</style>
    </>
  );
}

type PfSegment = "overall" | "setup" | "session" | "instrument";

function ProfitFactorExplorer({
  data,
  wl,
  currency,
  onMetricClick,
}: {
  data: AnalyticsDashboard;
  wl: NonNullable<AnalyticsDashboard["lab"]>["performance"]["win_loss"];
  currency: string;
  onMetricClick?: (metric: DrillMetric) => void;
}) {
  const [segment, setSegment] = useState<PfSegment>("overall");
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const pf = wl.profit_factor;

  const rows: { key: string; label: string; pf: number | null; n: number; grossPos?: number; grossNeg?: number }[] =
    useMemo(() => {
      if (segment === "overall") {
        return [
          {
            key: "overall",
            label: "Overall",
            pf: pf.value ? Number(pf.value) : null,
            n: pf.n,
            grossPos: Number(pf.gross_profit),
            grossNeg: Math.abs(Number(pf.gross_loss)),
          },
        ];
      }
      const source: (GroupRow | LabLeaderboardRow)[] =
        segment === "setup"
          ? data.setups
          : segment === "session"
            ? data.sessions
            : data.lab?.edge.instruments ?? [];
      return source
        .filter((r) => r.n > 0)
        .map((r) => ({
          key: r.key,
          label: segment === "session" ? sessionLabel(r.key) : "label" in r && r.label ? r.label : r.key,
          pf: r.profit_factor ? Number(r.profit_factor) : null,
          n: r.n,
          grossPos: r.net_pnl && Number(r.net_pnl) > 0 ? Number(r.net_pnl) : 0,
          grossNeg: r.net_pnl && Number(r.net_pnl) < 0 ? Math.abs(Number(r.net_pnl)) : 0,
        }))
        .sort((a, b) => (b.pf ?? -1) - (a.pf ?? -1))
        .slice(0, 12);
    }, [segment, data, pf, wl]);

  const compositionChart =
    segment === "overall"
      ? {
          grid: { left: 100, right: 24, top: 16, bottom: 24 },
          tooltip: { trigger: "axis" },
          xAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
          yAxis: { type: "category", data: ["Gross profit", "Gross loss"], inverse: true },
          series: [
            {
              type: "bar",
              data: [
                { value: Number(pf.gross_profit), itemStyle: { color: C.pos } },
                { value: Math.abs(Number(pf.gross_loss)), itemStyle: { color: C.neg } },
              ],
            },
          ],
        }
      : {
          grid: { left: 110, right: 56, top: 8, bottom: 24 },
          tooltip: {
            formatter: (p: { dataIndex: number }) => {
              const r = rows[p.dataIndex];
              return `${r.label}<br/>PF ${r.pf ?? "—"}<br/>n=${r.n}`;
            },
          },
          xAxis: { type: "value", name: "PF", splitLine: { lineStyle: { color: C.line } } },
          yAxis: {
            type: "category",
            data: rows.map((r) => r.label),
            inverse: true,
            axisLabel: { fontSize: 11 },
          },
          series: [
            {
              type: "bar",
              data: rows.map((r) => ({
                value: r.pf ?? 0,
                itemStyle: { color: (r.pf ?? 0) >= 1 ? C.pos : C.neg },
              })),
              label: { show: true, position: "right", fontSize: 10, formatter: (p: { dataIndex: number }) => `n=${rows[p.dataIndex].n}` },
            },
          ],
        };

  function handleBarClick(index: number) {
    if (!drill || segment === "overall") return;
    const row = rows[index];
    if (segment === "session") {
      drill.applyPatch({ session: row.key }, row.label);
    } else if (segment === "instrument") {
      drill.applyPatch({ symbol: row.key }, row.label);
    } else if (segment === "setup") {
      const id = data.filters.options?.setups.find((s) => s.name === row.key)?.id;
      if (id) drill.applyPatch({ setup_id: id }, row.label);
    }
    drill.openTrades(row.label);
  }

  return (
    <ChartCard
      title="Profit factor explorer"
      interactive
      actions={
        <button type="button" className="drill-btn" onClick={() => onMetricClick?.("profit_factor")}>
          Explain PF ↗
        </button>
      }
    >
      <div className="seg-toggles">
        {(
          [
            ["overall", "Overall"],
            ["setup", "By setup"],
            ["session", "By session"],
            ["instrument", "By instrument"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" className={segment === id ? "on" : ""} onClick={() => setSegment(id)}>
            {label}
          </button>
        ))}
      </div>
      {segment === "overall" && (
        <p className="muted">
          PF {pf.value ?? "—"} = {money(pf.gross_profit, currency)} gross profit ÷ {money(pf.gross_loss, currency)} gross loss
        </p>
      )}
      {rows.length === 0 ? (
        <Empty>No data for this segment.</Empty>
      ) : (
        <InteractiveChart
          option={compositionChart}
          height={segment === "overall" ? 140 : Math.max(180, rows.length * 32 + 40)}
          showHint={false}
          onChartClick={(e) => {
            if (e.dataIndex != null) handleBarClick(e.dataIndex);
          }}
        />
      )}
      <style jsx>{`
        .seg-toggles {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 12px;
        }
        .seg-toggles button {
          border: 1px solid var(--border);
          background: transparent;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          cursor: pointer;
        }
        .seg-toggles .on {
          background: var(--accent);
          color: var(--accent-contrast, #fff);
          border-color: var(--accent);
        }
        .muted {
          font-size: 13px;
          margin: 0 0 10px;
        }
        .drill-btn {
          border: none;
          background: transparent;
          color: var(--accent);
          font-size: 12px;
          cursor: pointer;
        }
      `}</style>
    </ChartCard>
  );
}

function WinLossSection({
  wl,
  currency,
  rDistribution,
}: {
  wl: NonNullable<AnalyticsDashboard["lab"]>["performance"]["win_loss"];
  currency: string;
  rDistribution: AnalyticsDashboard["r_distribution"];
}) {
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const winPct = wl.win_rate ? Number(wl.win_rate) : 0;
  const lossPct = wl.loss_rate ? Number(wl.loss_rate) : 0;

  const segmentedBar = {
    grid: { left: 0, right: 0, top: 8, bottom: 8 },
    xAxis: { type: "value", max: 100, show: false },
    yAxis: { type: "category", data: [""], show: false },
    series: [
      { type: "bar", stack: "total", data: [winPct], itemStyle: { color: C.pos }, name: "Win" },
      { type: "bar", stack: "total", data: [lossPct], itemStyle: { color: C.neg }, name: "Loss" },
      { type: "bar", stack: "total", data: [100 - winPct - lossPct], itemStyle: { color: C.muted }, name: "BE" },
    ],
  };

  const histogram =
    rDistribution.n >= 2
      ? {
          grid: { left: 44, right: 16, top: 16, bottom: 32 },
          tooltip: { trigger: "axis" },
          xAxis: {
            type: "category",
            data: rDistribution.bins.map((b) => `${num(b.from, 1)}–${num(b.to, 1)}`),
            axisLabel: { fontSize: 9, rotate: 35 },
          },
          yAxis: { type: "value", name: "Trades", splitLine: { lineStyle: { color: C.line } } },
          series: [
            {
              type: "bar",
              data: rDistribution.bins.map((b) => ({
                value: b.n,
                itemStyle: { color: b.from + b.to >= 0 ? C.pos : C.neg },
              })),
            },
          ],
        }
      : null;

  const pie = {
    tooltip: { trigger: "item" },
    series: [
      {
        type: "pie",
        radius: ["42%", "68%"],
        label: { formatter: "{b}: {d}%" },
        data: wl.composition.map((c) => ({
          name: c.label,
          value: c.n,
          itemStyle: { color: c.label === "Win" ? C.pos : c.label === "Loss" ? C.neg : C.muted },
        })),
      },
    ],
  };

  return (
    <>
      <ChartCard title="Win / loss analytics" sampleSize={wl.n} evidenceLabel={wl.evidence.label} subtitle="Distribution shows R-multiple shape" interactive>
        <div className="wl-labels">
          <span className="win">Wins {num(winPct, 1)}%</span>
          <span className="loss">Losses {num(lossPct, 1)}%</span>
        </div>
        <InteractiveChart
          option={segmentedBar}
          height={36}
          showHint={false}
          onChartClick={(e) => {
            if (!drill || !e.seriesName) return;
            const result = e.seriesName.toLowerCase();
            if (result === "win" || result === "loss" || result === "be") {
              const filterResult = result === "be" ? "breakeven" : result;
              drill.applyPatch({ result: filterResult }, `${result === "be" ? "Breakeven" : e.seriesName} trades`);
              drill.openTrades(`${e.seriesName} trades`);
            }
          }}
        />
        <div className="wl-grid">
          <div>
            <div className="mini-stats">
              <Stat label="Wins" value={String(wl.wins)} />
              <Stat label="Losses" value={String(wl.losses)} />
              <Stat label="Breakevens" value={String(wl.breakevens)} />
              <Stat label="Win/loss ratio" value={wl.win_loss_ratio ? num(wl.win_loss_ratio) : "—"} />
            </div>
          </div>
          <InteractiveChart
            option={pie}
            height={200}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || !e.name) return;
              const result = e.name.toLowerCase();
              if (result === "win" || result === "loss" || result === "breakeven") {
                drill.applyPatch({ result }, `${e.name} trades`);
                drill.openTrades(`${e.name} trades`);
              }
            }}
          />
        </div>
      </ChartCard>

      {histogram && (
        <ChartCard
          title="Trade outcome distribution (R)"
          subtitle={`Mean ${rDistribution.mean ?? "—"}R · median ${rDistribution.median ?? "—"}R · skew reveals tail risk vs consistency`}
          interactive
        >
          <InteractiveChart
            option={histogram}
            height={240}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || e.dataIndex == null) return;
              const bin = rDistribution.bins[e.dataIndex];
              if (!bin) return;
              const mid = (bin.from + bin.to) / 2;
              const result = mid > 0 ? "win" : mid < 0 ? "loss" : "breakeven";
              drill.applyPatch({ result }, `${bin.from}–${bin.to}R`);
              drill.openTrades(`R bin ${bin.from}–${bin.to}`);
            }}
          />
        </ChartCard>
      )}

      <style jsx>{`
        .wl-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 16px;
        }
        .wl-labels {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .win {
          color: var(--pos);
        }
        .loss {
          color: var(--neg);
        }
        .mini-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .muted {
          font-size: 13px;
          margin-top: 8px;
        }
        @media (max-width: 800px) {
          .wl-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

function PayoffComparison({
  wl,
  currency,
}: {
  wl: NonNullable<AnalyticsDashboard["lab"]>["performance"]["win_loss"];
  currency: string;
}) {
  const { C } = useLiveChart();
  const avgWin = Number(wl.average_win ?? 0);
  const avgLoss = Math.abs(Number(wl.average_loss ?? 0));
  const maxVal = Math.max(avgWin, avgLoss, 1);
  const payoff = wl.win_loss_ratio ? num(wl.win_loss_ratio) : "—";

  const chart = {
    grid: { left: 80, right: 24, top: 16, bottom: 24 },
    xAxis: { type: "value", max: maxVal * 1.15, splitLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "category", data: ["Avg win", "Avg loss"], inverse: true },
    series: [
      {
        type: "bar",
        data: [
          { value: avgWin, itemStyle: { color: C.pos } },
          { value: avgLoss, itemStyle: { color: C.neg } },
        ],
        label: {
          show: true,
          position: "right",
          formatter: (p: { dataIndex: number }) => money(p.dataIndex === 0 ? wl.average_win : wl.average_loss, currency),
        },
      },
    ],
  };

  return (
    <ChartCard title="Average win vs average loss" subtitle="How much you capture per unit of risk on winners vs losers">
      <div className="payoff-head">
        <div className="ratio">
          <span className="label">Payoff ratio</span>
          <strong>{payoff}</strong>
        </div>
      </div>
      <InteractiveChart option={chart} height={120} showHint={false} />
      <style jsx>{`
        .payoff-head {
          display: flex;
          align-items: baseline;
          gap: 16px;
          margin-bottom: 8px;
        }
        .ratio .label {
          display: block;
          font-size: 11px;
          text-transform: uppercase;
          color: var(--muted);
        }
        .ratio strong {
          font-size: 28px;
          font-family: var(--font-mono), monospace;
        }
        .muted {
          font-size: 13px;
          color: var(--muted);
        }
      `}</style>
    </ChartCard>
  );
}

function DirectionComparison({
  dc,
}: {
  dc: NonNullable<AnalyticsDashboard["lab"]>["performance"]["direction_comparison"];
  currency: string;
}) {
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const long = dc.long as Record<string, string | number | null>;
  const short = dc.short as Record<string, string | number | null>;

  const compareBars = {
    grid: { left: 44, right: 16, top: 16, bottom: 32 },
    tooltip: { trigger: "axis" },
    legend: { data: ["Long", "Short"], bottom: 0 },
    xAxis: { type: "category", data: ["Win rate %", "Profit factor", "Expectancy R"] },
    yAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        name: "Long",
        type: "bar",
        data: [Number(long.win_rate ?? 0), Number(long.profit_factor ?? 0), Number(long.expectancy_r ?? 0)],
        itemStyle: { color: C.long },
      },
      {
        name: "Short",
        type: "bar",
        data: [Number(short.win_rate ?? 0), Number(short.profit_factor ?? 0), Number(short.expectancy_r ?? 0)],
        itemStyle: { color: C.short },
      },
    ],
  };

  const quadrant = {
    grid: { left: 48, right: 16, top: 24, bottom: 40 },
    xAxis: { type: "value", name: "Win rate %", min: 0, max: 100, splitLine: { lineStyle: { color: C.line } } },
    yAxis: { type: "value", name: "Profit factor", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "scatter",
        data: [
          long.n
            ? {
                name: "Long",
                value: [Number(long.win_rate ?? 0), Number(long.profit_factor ?? 0)],
                symbolSize: Math.max(36, Number(long.n) * 4),
                itemStyle: { color: C.long },
              }
            : null,
          short.n
            ? {
                name: "Short",
                value: [Number(short.win_rate ?? 0), Number(short.profit_factor ?? 0)],
                symbolSize: Math.max(36, Number(short.n) * 4),
                itemStyle: { color: C.short },
              }
            : null,
        ].filter(Boolean),
      },
    ],
  };

  return (
    <ChartCard title="Long vs short" subtitle={`Long n=${long.n ?? 0} · Short n=${short.n ?? 0}`} interactive>
      {(Number(long.n) > 0 || Number(short.n) > 0) && (
        <>
          <InteractiveChart
            option={compareBars}
            height={220}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || !e.seriesName) return;
              const dir = e.seriesName.toLowerCase();
              if (dir === "long" || dir === "short") {
                drill.applyPatch({ direction: dir }, `${e.seriesName} trades`);
                drill.openTrades(`${e.seriesName} trades`);
              }
            }}
          />
          <InteractiveChart
            option={quadrant}
            height={200}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || !e.name) return;
              const dir = e.name.toLowerCase();
              if (dir === "long" || dir === "short") {
                drill.applyPatch({ direction: dir }, `${e.name} trades`);
                drill.openTrades(`${e.name} trades`);
              }
            }}
          />
        </>
      )}
    </ChartCard>
  );
}

function RankedTradesPanel({
  bt,
  currency,
  timezone,
}: {
  bt: NonNullable<AnalyticsDashboard["lab"]>["performance"]["best_trades"];
  currency: string;
  timezone: string;
}) {
  return (
    <div className="ranked-pair">
      <RankedTradeList title="Top trades" rows={bt.winners} currency={currency} timezone={timezone} positive />
      <RankedTradeList title="Worst trades" rows={bt.losers} currency={currency} timezone={timezone} positive={false} />
      <style jsx>{`
        .ranked-pair {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 900px) {
          .ranked-pair {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function RankedTradeList({
  title,
  rows,
  currency,
  timezone,
  positive,
}: {
  title: string;
  rows: LabTradeRank[];
  currency: string;
  timezone: string;
  positive: boolean;
}) {
  if (!rows.length) return null;
  const maxR = Math.max(...rows.map((r) => Math.abs(Number(r.r_multiple ?? 0))), 0.01);
  const maxPnl = Math.max(...rows.map((r) => Math.abs(Number(r.net_pnl))), 0.01);

  return (
    <Panel title={title}>
      <ol className="rank-list">
        {rows.map((r) => {
          const rVal = Math.abs(Number(r.r_multiple ?? 0));
          const width = rVal > 0 ? Math.min(100, (rVal / maxR) * 100) : Math.min(100, (Math.abs(Number(r.net_pnl)) / maxPnl) * 100);
          return (
            <li key={r.trade_id}>
              <Link href={`/trades/${r.trade_id}`} className="row">
                <span className="rank">{String(r.rank).padStart(2, "0")}</span>
                <div className="body">
                  <div className="top">
                    <strong>
                      {r.symbol} · {r.setup}
                    </strong>
                    <span className={positive ? "pos" : "neg"}>
                      {r.r_multiple ? `${signed(r.r_multiple)}R` : money(r.net_pnl, currency)}
                    </span>
                  </div>
                  <div className={`bar ${positive ? "pos" : "neg"}`} style={{ width: `${width}%` }} />
                  <span className="meta">
                    {formatWhen(r.entry_at, timezone)} · {r.direction}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
      <style jsx>{`
        .rank-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        li {
          border-bottom: 1px solid var(--border);
        }
        .row {
          display: flex;
          gap: 10px;
          padding: 10px 4px;
          text-decoration: none;
          color: inherit;
        }
        .row:hover {
          background: var(--surface-2);
        }
        .rank {
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          color: var(--muted);
          min-width: 24px;
        }
        .body {
          flex: 1;
          min-width: 0;
        }
        .top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 13px;
        }
        .bar {
          height: 6px;
          border-radius: 3px;
          margin: 6px 0 4px;
          max-width: 100%;
        }
        .bar.pos {
          background: var(--pos);
        }
        .bar.neg {
          background: var(--neg);
        }
        .meta {
          font-size: 11px;
          color: var(--muted);
        }
        .pos {
          color: var(--pos);
          font-family: var(--font-mono), monospace;
        }
        .neg {
          color: var(--neg);
          font-family: var(--font-mono), monospace;
        }
      `}</style>
    </Panel>
  );
}
