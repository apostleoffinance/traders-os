"use client";

import { useMemo, useState } from "react";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { EquityInteractiveChart } from "@/components/analytics/primitives/EquityInteractive";
import { Empty, useLiveChart } from "@/components/analytics/Charts";
import type { EquityPt } from "@/lib/analytics";
import { colorForBinRange } from "@/lib/chart-colors";
import { money, num } from "@/lib/format";

type EqPoint = { at: string; equity: string; cumulative_r?: string };

export function ReportPerformanceSection({
  performance,
  currency,
  confidence,
}: {
  performance: Record<string, unknown>;
  currency: string;
  confidence: { level: string; message: string };
}) {
  const { C } = useLiveChart();
  const [eqMode, setEqMode] = useState<"net_pnl" | "r_multiple">("net_pnl");
  const kpis = (performance.kpis ?? {}) as Record<string, { value?: string }>;
  const wl = (performance.win_loss ?? {}) as Record<string, unknown>;
  const equity = (performance.equity_curve ?? {}) as {
    net_pnl?: { curve: EqPoint[] };
    markers?: unknown[];
  };
  const calendar = (performance.calendar ?? []) as { date: string; n: number; net_pnl: string; r?: string }[];
  const dist = (performance.distributions ?? {}) as Record<string, unknown>;

  const rHist = useMemo(() => {
    const bins = (dist.r_multiple as { bins?: { from: number; to: number; n: number }[] })?.bins ?? [];
    if (!bins.length) return null;
    return {
      grid: { left: 44, right: 16, top: 16, bottom: 40 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", data: bins.map((b) => `${num(b.from, 1)}–${num(b.to, 1)}`), axisLabel: { rotate: 35, fontSize: 9 } },
      yAxis: { type: "value", name: "Trades", splitLine: { lineStyle: { color: C.line } } },
      series: [
        {
          type: "bar",
          data: bins.map((b) => ({
            value: b.n,
            itemStyle: { color: colorForBinRange(C, b.from, b.to) },
          })),
        },
      ],
    };
  }, [dist, C]);

  const netCurve: EquityPt[] = useMemo(
    () =>
      (equity.net_pnl?.curve ?? []).map((p) => ({
        at: p.at,
        equity: String(p.equity),
        peak: String((p as { peak?: string }).peak ?? p.equity),
        drawdown: String((p as { drawdown?: string }).drawdown ?? "0"),
        drawdown_pct: String((p as { drawdown_pct?: string }).drawdown_pct ?? "0"),
        daily_pnl: String((p as { daily_pnl?: string }).daily_pnl ?? "0"),
        cumulative_r: String(p.cumulative_r ?? "0"),
      })),
    [equity.net_pnl?.curve],
  );

  return (
    <>
      <h2 className="section-title">Performance analysis</h2>
      <div className="kpi-row">
        <Kpi label="Net P&L" value={kpis.net_pnl?.value ? money(kpis.net_pnl.value, currency) : "—"} />
        <Kpi label="Win rate" value={wl.win_rate ? `${wl.win_rate}%` : "—"} />
        <Kpi label="Profit factor" value={kpis.profit_factor?.value ?? "—"} />
        <Kpi label="Expectancy R" value={kpis.expectancy_r?.value ? `${kpis.expectancy_r.value}R` : "—"} />
        <Kpi label="Average R" value={kpis.average_r?.value ? `${kpis.average_r.value}R` : "—"} />
      </div>

      <ChartCard
        title="Equity curve"
        subtitle={confidence.message}
        interactive
        actions={
          <div className="modes">
            <button type="button" className={eqMode === "net_pnl" ? "on" : ""} onClick={() => setEqMode("net_pnl")}>
              Currency
            </button>
            <button type="button" className={eqMode === "r_multiple" ? "on" : ""} onClick={() => setEqMode("r_multiple")}>
              Cumulative R
            </button>
          </div>
        }
      >
        {netCurve.length >= 2 ? (
          <EquityInteractiveChart
            netCurve={netCurve}
            grossCurve={[]}
            markers={(equity.markers as never[]) ?? []}
            mode={eqMode}
            currency={currency}
          />
        ) : (
          <Empty>Not enough trades for an equity curve.</Empty>
        )}
      </ChartCard>

      <ChartCard title="Daily P&L calendar" interactive>
        {calendar.length ? (
          <div className="cal">
            {calendar.map((d) => {
              const pnl = Number(d.net_pnl);
              const t = Math.min(1, Math.abs(pnl) / 100);
              const bg = pnl >= 0 ? `rgba(24,185,129,${0.15 + t * 0.6})` : `rgba(239,68,68,${0.15 + t * 0.6})`;
              return (
                <div key={d.date} className="cell" style={{ background: bg }} title={`${d.date} · ${money(d.net_pnl, currency)} · n=${d.n}`}>
                  <span>{d.date.slice(8)}</span>
                  <span>{d.r != null ? `${num(d.r, 1)}R` : "—"}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>No trading days in period.</Empty>
        )}
      </ChartCard>

      {rHist && (
        <ChartCard title="R-multiple distribution" interactive>
          <InteractiveChart option={rHist} height={220} showHint={false} />
        </ChartCard>
      )}

      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 16px;
        }
        .kpi-row {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }
        .modes {
          display: flex;
          gap: 4px;
        }
        .modes button {
          font-size: 11px;
          padding: 4px 8px;
          border: 1px solid var(--border);
          background: transparent;
          border-radius: 999px;
          cursor: pointer;
        }
        .modes .on {
          background: var(--accent);
          color: var(--accent-contrast, #fff);
        }
        .cal {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
          gap: 4px;
        }
        .cell {
          border-radius: 4px;
          padding: 6px 4px;
          font-size: 10px;
          text-align: center;
          display: flex;
          flex-direction: column;
        }
      `}</style>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <style jsx>{`
        .kpi {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 12px;
        }
        span {
          font-size: 10px;
          text-transform: uppercase;
          color: var(--muted);
        }
        strong {
          display: block;
          margin-top: 4px;
          font-family: var(--font-mono), monospace;
        }
      `}</style>
    </div>
  );
}
