"use client";

import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { Panel } from "@/components/ui";
import { money, num } from "@/lib/format";
import { type AnalyticsDashboard } from "@/lib/analytics";
import { Empty, useLiveChart } from "@/components/analytics/Charts";

type Mode = "equity" | "r" | "drawdown";

export function EquityDrawdown({ data }: { data: AnalyticsDashboard }) {
  const [mode, setMode] = useState<Mode>("equity");
  const { C } = useLiveChart();
  const curve = data.equity;
  if (curve.length < 2) {
    return (
      <Panel title="Equity & drawdown">
        <Empty>Journal closed trades to build the curve.</Empty>
      </Panel>
    );
  }
  const series =
    mode === "equity"
      ? { name: "Equity", data: curve.map((p) => Number(p.equity)), color: C.blue }
      : mode === "r"
        ? { name: "Cumulative R", data: curve.map((p) => Number(p.cumulative_r)), color: C.pos }
        : { name: "Drawdown", data: curve.map((p) => Number(p.drawdown)), color: C.neg };

  const option = {
    grid: { left: 52, right: 16, top: 28, bottom: 32 },
    tooltip: {
      trigger: "axis",
      formatter: (params: { dataIndex: number }[]) => {
        const i = params[0]?.dataIndex ?? 0;
        const p = curve[i];
        return [
          p.at.slice(0, 16).replace("T", " "),
          `Balance ${money(p.equity, data.account.currency)}`,
          `Peak ${money(p.peak, data.account.currency)}`,
          `Drawdown ${money(p.drawdown, data.account.currency)} (${num(p.drawdown_pct, 2)}%)`,
          `Cumulative R ${num(p.cumulative_r)}R`,
          `Trades through this point ${i}`,
        ].join("<br/>");
      },
    },
    xAxis: {
      type: "category",
      data: curve.map((p) => p.at.slice(0, 10)),
      axisLabel: { fontSize: 10, color: C.muted },
    },
    yAxis: { type: "value", axisLabel: { fontSize: 10, color: C.muted }, splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "line",
        name: series.name,
        data: series.data,
        showSymbol: false,
        lineStyle: { width: 1.6, color: series.color },
        areaStyle: mode === "drawdown" ? { color: `${C.neg}22` } : undefined,
      },
    ],
  };
  const dd = data.drawdown;
  return (
    <Panel
      title="Equity & drawdown"
      right={
        <div className="modes">
          {(["equity", "r", "drawdown"] as Mode[]).map((m) => (
            <button key={m} type="button" className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
              {m === "r" ? "Cumulative R" : m === "equity" ? "Equity" : "Drawdown"}
            </button>
          ))}
        </div>
      }
    >
      <ReactECharts option={option} style={{ height: 300 }} />
      <div className="meta">
        <span>Peak {money(dd.peak, data.account.currency)}</span>
        <span>Equity {money(dd.equity, data.account.currency)}</span>
        <span>Current DD {money(dd.current, data.account.currency)}</span>
        <span>Max DD {money(dd.max, data.account.currency)}</span>
        {dd.open && <span>Open drawdown {dd.open.duration_days}d · depth {money(dd.open.depth, data.account.currency)}</span>}
      </div>
      <style jsx>{`
        .modes {
          display: flex;
          gap: 4px;
        }
        .modes button {
          border: 1px solid var(--line-strong);
          background: transparent;
          padding: 3px 8px;
          font-size: 11px;
        }
        .modes .on {
          background: var(--accent);
          color: var(--accent-contrast);
          border-color: var(--accent);
        }
        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 18px;
          margin-top: 8px;
          color: var(--muted);
          font-size: 12px;
        }
      `}</style>
    </Panel>
  );
}
