"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Dashboard, Trade } from "@/lib/types";
import type { TradeReplay } from "@/lib/trade-replay";
import { useGlobalFilters } from "@/lib/filters";
import { homeConfidenceLine } from "@/lib/command-center/copy";
import { periodLabelShort } from "@/lib/command-center/period";
import {
  buildEquityFromTrades,
  buildRCurveFromTrades,
  closedTradesInPeriod,
} from "@/lib/command-center/equity";
import { MetricCard, PeriodStrip, ChartCard } from "@/components/trader";
import { MiniSparkline } from "@/components/analytics/primitives/MiniSparkline";
import { EquityCurve } from "@/components/visualizations/performance/EquityCurve";
import { UnderwaterCurve } from "@/components/visualizations/risk/UnderwaterCurve";
import { TradeAnatomy } from "@/components/visualizations/trade-anatomy";
import { LimitBar, Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui";
import { holdingLabel, money, num, sessionLabel, signed, tone } from "@/lib/format";

type Props = {
  data: Dashboard;
  trades: Trade[];
  openTrades: Trade[];
};

type EquityMode = "equity" | "drawdown" | "r";

function sparkValues(points: { equity: string }[]): number[] {
  return points.map((p) => Number(p.equity)).filter((n) => Number.isFinite(n));
}

function resultClass(result: string): string {
  if (result === "win") return "win";
  if (result === "loss") return "loss";
  return "be";
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function periodStats(trades: Trade[]) {
  const n = trades.length;
  const wins = trades.filter((t) => t.result === "win").length;
  const losses = trades.filter((t) => t.result === "loss").length;
  let pnl = 0;
  let rSum = 0;
  let rN = 0;
  for (const t of trades) {
    if (t.realized_pnl != null) pnl += Number(t.realized_pnl);
    if (t.realized_r != null) {
      rSum += Number(t.realized_r);
      rN += 1;
    }
  }
  const winRate = n > 0 ? (wins / n) * 100 : null;
  const avgR = rN > 0 ? rSum / rN : null;
  return { n, wins, losses, pnl, winRate, avgR };
}

export function CommandCenterView({ data, trades, openTrades }: Props) {
  const cc = data.command_center;
  const currency = data.account.currency;
  const { filters } = useGlobalFilters();
  const period = filters.period;
  const [mode, setMode] = useState<EquityMode>("equity");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replay, setReplay] = useState<TradeReplay | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);

  const periodTrades = useMemo(() => closedTradesInPeriod(trades, period), [trades, period]);
  const starting = Number(data.starting_balance) || 0;

  const equityCurve = useMemo(
    () => buildEquityFromTrades(periodTrades, starting),
    [periodTrades, starting],
  );

  const rCurve = useMemo(() => buildRCurveFromTrades(periodTrades), [periodTrades]);
  const ddPoints = useMemo(
    () =>
      equityCurve.map((p) => ({
        at: p.at,
        drawdown: p.drawdown,
        drawdown_pct: p.drawdown_pct,
        equity: p.equity,
        peak: p.peak,
      })),
    [equityCurve],
  );

  const stats = useMemo(() => periodStats(periodTrades), [periodTrades]);
  const spark = useMemo(() => sparkValues(equityCurve), [equityCurve]);

  const recentClosed = useMemo(
    () =>
      [...periodTrades]
        .sort(
          (a, b) =>
            Date.parse(b.exit_timestamp ?? b.trade_timestamp) -
            Date.parse(a.exit_timestamp ?? a.trade_timestamp),
        )
        .slice(0, 12),
    [periodTrades],
  );

  const selected = useMemo(
    () => trades.find((t) => t.id === selectedId) ?? null,
    [trades, selectedId],
  );

  useEffect(() => {
    if (!selectedId) {
      setReplay(null);
      setReplayError(null);
      return;
    }
    let cancelled = false;
    setReplayLoading(true);
    setReplayError(null);
    void api<TradeReplay>(`/api/trades/${selectedId}/replay`)
      .then((r) => {
        if (!cancelled) setReplay(r);
      })
      .catch((err) => {
        if (!cancelled) {
          setReplay(null);
          setReplayError(err instanceof Error ? err.message : "Could not load trade anatomy.");
        }
      })
      .finally(() => {
        if (!cancelled) setReplayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const wr = stats.winRate != null ? `${num(stats.winRate, 1)}%` : "—";
  const avgR = stats.avgR != null ? `${signed(stats.avgR)}R` : "—";
  const maxDd = money(data.max_drawdown, currency);
  const confidence = homeConfidenceLine(stats.n, data.sample_note);

  return (
    <div className="cc">
      <div className="toolbar">
        <PeriodStrip />
        <p className="muted sample" role="status">
          {confidence}
          <span className="period-hint"> · {periodLabelShort(period)}</span>
        </p>
      </div>

      <div className="tos-kpi-grid">
        <MetricCard
          label="Total P&L"
          value={signed(stats.pnl)}
          tone={tone(stats.pnl) === "pos" ? "pos" : tone(stats.pnl) === "neg" ? "neg" : ""}
          hint={periodLabelShort(period)}
          spark={spark.length >= 2 ? <MiniSparkline values={spark} height={26} /> : undefined}
        />
        <MetricCard
          label="Win rate"
          value={wr}
          tone={stats.winRate != null && stats.winRate >= 50 ? "pos" : stats.winRate != null ? "neg" : ""}
          hint={
            stats.n > 0
              ? `${stats.wins} win${stats.wins === 1 ? "" : "s"} / ${stats.n} trade${stats.n === 1 ? "" : "s"}`
              : "No trades"
          }
          spark={spark.length >= 2 ? <MiniSparkline values={spark} height={26} /> : undefined}
        />
        <MetricCard
          label="Avg R / trade"
          value={avgR}
          tone={stats.avgR != null && stats.avgR >= 0 ? "pos" : stats.avgR != null ? "neg" : ""}
          hint="Average result"
          spark={spark.length >= 2 ? <MiniSparkline values={spark} height={26} /> : undefined}
        />
        <MetricCard
          label="Max drawdown"
          value={maxDd}
          tone="neg"
          hint={`Current ${money(data.drawdown, currency)}`}
          spark={spark.length >= 2 ? <MiniSparkline values={spark} height={26} /> : undefined}
        />
      </div>

      <div className="main-grid">
        <section className="hero tos-panel">
          <div className="hero-head">
            <h2 className="tos-panel-title" style={{ margin: 0 }}>
              Equity curve
            </h2>
            <div className="mode-tabs" role="tablist" aria-label="Equity view">
              {(
                [
                  ["equity", "Equity"],
                  ["drawdown", "Drawdown"],
                  ["r", "R"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={mode === id}
                  className={mode === id ? "active" : ""}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="hero-body">
            {mode === "equity" &&
              (equityCurve.length >= 2 ? (
                <EquityCurve
                  curve={equityCurve}
                  currency={currency}
                  compact
                  fillContainer
                  showRangeControls={false}
                  defaultRange="ALL"
                />
              ) : (
                <p className="empty muted">
                  {stats.n === 0
                    ? "No closed trades in this period yet."
                    : "Need at least two closed trades in this period to draw equity."}
                </p>
              ))}
            {mode === "drawdown" &&
              (ddPoints.length >= 2 ? (
                <UnderwaterCurve
                  curve={ddPoints}
                  currency={currency}
                  fillContainer
                  showRangeControls={false}
                  defaultRange="ALL"
                />
              ) : (
                <p className="empty muted">Not enough equity history for drawdown in this period.</p>
              ))}
            {mode === "r" &&
              (rCurve.length >= 2 ? (
                <EquityCurve
                  curve={rCurve}
                  currency={currency}
                  compact
                  fillContainer
                  showRangeControls={false}
                  defaultRange="ALL"
                  metric="cumulative_r"
                />
              ) : (
                <p className="empty muted">Need closed trades with R results in this period.</p>
              ))}
          </div>
        </section>

        <aside className="side">
          <div className="tos-panel recent">
            <h2 className="tos-panel-title">Recent trades</h2>
            {recentClosed.length === 0 ? (
              <p className="muted empty">No closed trades in this period.</p>
            ) : (
              <table className="blotter">
                <thead>
                  <tr>
                    <th>Trade</th>
                    <th>R</th>
                    <th>Result</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClosed.map((t) => (
                    <tr key={t.id} onClick={() => setSelectedId(t.id)}>
                      <td>
                        <strong>
                          {t.symbol} {t.direction.toUpperCase()}
                        </strong>
                      </td>
                      <td className={`num ${tone(t.realized_r)}`}>
                        {t.realized_r != null ? `${signed(t.realized_r)}R` : "—"}
                      </td>
                      <td>
                        <span className={`tos-result ${resultClass(t.result)}`}>
                          {(t.result || "—").toUpperCase()}
                        </span>
                      </td>
                      <td className="muted when">{formatWhen(t.exit_timestamp ?? t.trade_timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="tos-panel capacity">
            <h2 className="tos-panel-title">Risk budget</h2>
            <p className="cap-line">
              <strong>{cc.trading_capacity.full_risk_trades_remaining}</strong>{" "}
              {cc.trading_capacity.full_risk_trades_remaining === 1
                ? "full-risk trade left today"
                : "full-risk trades left today"}
            </p>
            <LimitBar
              label="Today's risk"
              limit={data.personal_daily_loss.limit}
              remaining={data.personal_daily_loss.remaining}
            />
            <LimitBar
              label="Drawdown used"
              limit={data.personal_max_dd.limit}
              remaining={data.personal_max_dd.remaining}
            />
            {openTrades.length > 0 && (
              <p className="muted open-n">
                {openTrades.length} open · <Link href="/trades?status=open">View</Link>
              </p>
            )}
          </div>
        </aside>
      </div>

      {(cc.edge_snapshot || cc.behaviour_watch || cc.insights.length > 0) && (
        <div className="insight-row">
          {cc.edge_snapshot && (
            <ChartCard title="Worth a look">
              <p className="ins-title">{cc.edge_snapshot.label}</p>
              <p className={`num ${tone(cc.edge_snapshot.expectancy_r)}`}>
                {signed(cc.edge_snapshot.expectancy_r)}R · {cc.edge_snapshot.n} trades
              </p>
              <p className="muted">{cc.edge_snapshot.insight}</p>
            </ChartCard>
          )}
          {cc.behaviour_watch && (
            <ChartCard title="Behaviour watch">
              <p className="ins-title">{cc.behaviour_watch.title}</p>
              <p className="muted">{cc.behaviour_watch.summary}</p>
            </ChartCard>
          )}
          {cc.insights.slice(0, 2).map((ins) => (
            <ChartCard key={ins.title} title={ins.title}>
              <p className="muted">{ins.summary}</p>
            </ChartCard>
          ))}
        </div>
      )}

      <Sheet open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="trade-drawer">
          <SheetHeader>
            <SheetTitle>
              {selected ? `${selected.symbol} ${selected.direction.toUpperCase()}` : "Trade"}
            </SheetTitle>
            <SheetDescription>
              {selected
                ? `${sessionLabel(selected.session)} · ${selected.timeframe} · ${formatWhen(selected.exit_timestamp ?? selected.trade_timestamp)}`
                : "Trade detail"}
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="drawer-body">
              <div className="meta-grid">
                <div>
                  <span className="k">Entry</span>
                  <span className="num">{selected.entry_price}</span>
                </div>
                <div>
                  <span className="k">SL</span>
                  <span className="num">{selected.stop_loss}</span>
                </div>
                <div>
                  <span className="k">TP</span>
                  <span className="num">{selected.take_profit ?? "—"}</span>
                </div>
                <div>
                  <span className="k">Exit</span>
                  <span className="num">{selected.exit_price ?? "—"}</span>
                </div>
                <div>
                  <span className="k">R</span>
                  <span className={`num ${tone(selected.realized_r)}`}>
                    {selected.realized_r != null ? `${signed(selected.realized_r)}R` : "—"}
                  </span>
                </div>
                <div>
                  <span className="k">Hold</span>
                  <span>{holdingLabel(selected.holding_time_seconds)}</span>
                </div>
              </div>
              {replayLoading && <p className="muted">Loading anatomy…</p>}
              {replayError && <p className="muted">{replayError}</p>}
              {replay && (
                <TradeAnatomy
                  compact
                  replay={replay}
                  fallbacks={{
                    mfeR: selected.mfe_r,
                    maeR: selected.mae_r,
                    mfePrice: selected.mfe_price,
                    maePrice: selected.mae_price,
                    mfeAt: selected.mfe_at,
                    maeAt: selected.mae_at,
                    realizedR: selected.realized_r,
                    plannedRr: selected.planned_rr,
                    holdSeconds: selected.holding_time_seconds,
                  }}
                />
              )}
              <Link href={`/trades/${selected.id}`} className="btn ghost full">
                Open full trade →
              </Link>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <style jsx>{`
        .cc {
          display: grid;
          gap: 14px;
        }
        .toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .sample {
          margin: 0;
          font-size: 13px;
          max-width: 42ch;
        }
        .period-hint {
          opacity: 0.75;
        }
        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.65fr) minmax(260px, 0.95fr);
          gap: 14px;
          align-items: stretch;
        }
        .hero {
          display: flex;
          flex-direction: column;
          min-height: 0;
          height: 100%;
          flex: 1 1 auto;
        }
        .hero-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }
        .hero-body {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .mode-tabs {
          display: inline-flex;
          gap: 4px;
          padding: 3px;
          border-radius: 8px;
          background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .mode-tabs button {
          border: 0;
          background: transparent;
          color: var(--text-muted);
          padding: 5px 11px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .mode-tabs button.active {
          background: var(--accent-soft);
          color: var(--accent);
        }
        .mode-tabs button:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
        .side {
          display: grid;
          gap: 14px;
          min-width: 0;
        }
        .cap-line {
          margin: 0 0 10px;
          font-size: 13px;
        }
        .open-n {
          margin: 10px 0 0;
          font-size: 12px;
        }
        .empty {
          margin: 8px 0 0;
          font-size: 13px;
        }
        .blotter {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .blotter th {
          text-align: left;
          font-size: 10px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 600;
          padding: 0 6px 8px 0;
        }
        .blotter td {
          padding: 8px 6px 8px 0;
          border-top: 1px solid var(--border);
          vertical-align: middle;
        }
        .blotter tr {
          cursor: pointer;
        }
        .blotter tr:hover td {
          background: color-mix(in srgb, var(--accent-soft) 35%, transparent);
        }
        .blotter .when {
          white-space: nowrap;
        }
        .insight-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }
        .ins-title {
          margin: 0 0 6px;
          font-weight: 600;
          font-size: 14px;
        }
        .drawer-body {
          display: grid;
          gap: 14px;
          padding: 0 4px 16px;
          overflow: auto;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .meta-grid .k {
          display: block;
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        .full {
          display: inline-flex;
          justify-content: center;
          width: 100%;
        }
        :global(.trade-drawer) {
          width: min(440px, 100vw);
          background: var(--surface);
          border-left: 1px solid var(--border);
          overflow-y: auto;
        }
        @media (max-width: 980px) {
          .main-grid {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 560px) {
          .meta-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .blotter .when {
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}
