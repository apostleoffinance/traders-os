"use client";

import { useMemo } from "react";
import { Stat } from "@/components/ui";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useLiveChart } from "@/components/analytics/Charts";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { generateWinLossInsight } from "@/lib/analytics/insights/generators";
import { getAnalyticsDefinition } from "@/lib/analytics/registry";
import { money, num } from "@/lib/format";

export function HowYouWinSection({ data }: { data: AnalyticsDashboard }) {
  const lab = data.lab;
  if (!lab || lab.metadata.sample_size === 0) return null;

  const wl = lab.performance.win_loss;
  const dc = lab.performance.direction_comparison;
  const currency = data.account.currency;
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();

  const winPct = wl.win_rate ? Number(wl.win_rate) : 0;
  const lossPct = wl.loss_rate ? Number(wl.loss_rate) : 0;

  const winLossBar = {
    grid: { left: 0, right: 0, top: 8, bottom: 8 },
    xAxis: { type: "value", max: 100, show: false },
    yAxis: { type: "category", data: [""], show: false },
    series: [
      { type: "bar", stack: "total", data: [winPct], itemStyle: { color: C.pos }, name: "Win" },
      { type: "bar", stack: "total", data: [lossPct], itemStyle: { color: C.neg }, name: "Loss" },
      { type: "bar", stack: "total", data: [Math.max(0, 100 - winPct - lossPct)], itemStyle: { color: C.muted }, name: "BE" },
    ],
  };

  const pf = wl.profit_factor;
  const grossChart = {
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
  };

  const avgWin = Number(wl.average_win ?? 0);
  const avgLoss = Math.abs(Number(wl.average_loss ?? 0));
  const maxVal = Math.max(avgWin, avgLoss, 1);
  const payoffChart = {
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

  const long = dc.long as Record<string, string | number | null>;
  const short = dc.short as Record<string, string | number | null>;
  const directionChart = {
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

  const winLossInsight = useMemo(
    () =>
      generateWinLossInsight({
        winRate: wl.win_rate ? Number(wl.win_rate) : null,
        lossRate: wl.loss_rate ? Number(wl.loss_rate) : null,
        winLossRatio: wl.win_loss_ratio ? Number(wl.win_loss_ratio) : null,
        trades: wl.n,
      }),
    [wl],
  );

  const winLossDef = getAnalyticsDefinition("win_loss_breakdown");
  const grossDef = getAnalyticsDefinition("gross_profit_vs_loss");
  const payoffDef = getAnalyticsDefinition("avg_win_vs_loss");
  const directionDef = getAnalyticsDefinition("long_vs_short");

  return (
    <section className="section">
      <h2 className="section-title">How you win</h2>
      <p className="section-lead">Understand your win rate, payoff, and direction mix at a glance.</p>

      <div className="grid">
        <ChartCard
          title={winLossDef?.title ?? "Win / loss / breakeven"}
          question={winLossDef?.primaryQuestion ?? "How often do I win vs lose?"}
          tier={winLossDef?.tier}
          sampleSize={wl.n}
          evidenceLabel={wl.evidence.label}
          insight={winLossInsight}
          interactive
        >
          <div className="wl-labels">
            <span className="win">Wins {num(winPct, 1)}%</span>
            <span className="loss">Losses {num(lossPct, 1)}%</span>
          </div>
          <InteractiveChart
            option={winLossBar}
            height={36}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || !e.seriesName) return;
              const result = e.seriesName.toLowerCase();
              if (result === "win" || result === "loss" || result === "be") {
                const filterResult = result === "be" ? "breakeven" : result;
                drill.applyPatch({ result: filterResult }, `${e.seriesName} trades`);
                drill.openTrades(`${e.seriesName} trades`);
              }
            }}
          />
          <div className="mini-stats">
            <Stat label="Wins" value={String(wl.wins)} />
            <Stat label="Losses" value={String(wl.losses)} />
            <Stat label="Breakevens" value={String(wl.breakevens)} />
          </div>
        </ChartCard>

        <ChartCard
          title={grossDef?.title ?? "Gross profit vs gross loss"}
          question={grossDef?.primaryQuestion}
          tier={grossDef?.tier}
        >
          <InteractiveChart option={grossChart} height={120} showHint={false} />
          <p className="pf-note">Profit factor: {pf.value ? num(pf.value) : pf.note ?? "—"}</p>
        </ChartCard>

        <ChartCard title={payoffDef?.title ?? "Average win vs average loss"} question={payoffDef?.primaryQuestion} tier={payoffDef?.tier}>
          <p className="payoff">Payoff ratio: {wl.win_loss_ratio ? num(wl.win_loss_ratio) : "—"}</p>
          <InteractiveChart option={payoffChart} height={120} showHint={false} />
        </ChartCard>

        {(Number(long.n) > 0 || Number(short.n) > 0) && (
          <ChartCard
            title={directionDef?.title ?? "Long vs short"}
            question={directionDef?.primaryQuestion}
            tier={directionDef?.tier}
            subtitle={`Long n=${long.n ?? 0} · Short n=${short.n ?? 0}`}
            interactive
          >
            <InteractiveChart
              option={directionChart}
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
          </ChartCard>
        )}
      </div>

      <style jsx>{`
        .section {
          margin-bottom: 8px;
        }
        .section-title {
          margin: 0 0 4px;
          font-size: 18px;
        }
        .section-lead {
          margin: 0 0 14px;
          font-size: 14px;
          color: var(--text-muted);
        }
        .grid {
          display: grid;
          gap: 0;
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
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 12px;
        }
        .pf-note,
        .payoff {
          margin: 8px 0 0;
          font-size: 13px;
          color: var(--text-muted);
        }
      `}</style>
    </section>
  );
}
