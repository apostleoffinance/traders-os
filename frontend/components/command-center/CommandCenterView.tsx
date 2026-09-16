"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Dashboard, Trade } from "@/lib/types";
import type { EquityPt } from "@/lib/analytics";
import type { TradeReplay } from "@/lib/trade-replay";
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

function sparkValues(series: { balance: string }[]): number[] {
  return series.map((p) => Number(p.balance)).filter((n) => Number.isFinite(n));
}

/** Map dashboard equity series → EquityCurve points (deterministic peak/DD). */
function mapEquitySeries(series: Dashboard["equity_series"]): EquityPt[] {
  let peak = 0;
  return series.map((p) => {
    const equity = Number(p.balance);
    peak = Math.max(peak, equity);
    const dd = peak > 0 ? peak - equity : 0;
    const ddPct = peak > 0 ? (dd / peak) * 100 : 0;
    return {
      at: p.t,
      equity: p.balance,
      peak: String(peak),
      drawdown: String(dd),
      drawdown_pct: String(ddPct),
      daily_pnl: "0",
      cumulative_r: "0",
    };
  });
}

/** Build cumulative R series from closed trades with realized_r. */
function mapRCurve(trades: Trade[]): EquityPt[] {
  const closed = [...trades]
    .filter((t) => t.status === "closed" && t.realized_r != null && t.exit_timestamp)
    .sort((a, b) => Date.parse(a.exit_timestamp!) - Date.parse(b.exit_timestamp!));
  let cum = 0;
  let peak = 0;
  return closed.map((t) => {
    cum += Number(t.realized_r);
    peak = Math.max(peak, cum);
    const dd = peak - cum;
    return {
      at: t.exit_timestamp!,
      equity: String(cum),
      peak: String(peak),
      drawdown: String(Math.max(0, dd)),
      drawdown_pct: peak !== 0 ? String((Math.max(0, dd) / Math.abs(peak)) * 100) : "0",
      daily_pnl: t.realized_r ?? "0",
      cumulative_r: String(cum),
    };
  });
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

export function CommandCenterView({ data, trades, openTrades }: Props) {
  const cc = data.command_center;
  const currency = data.account.currency;
  const [mode, setMode] = useState<EquityMode>("equity");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replay, setReplay] = useState<TradeReplay | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);

  const equityCurve = useMemo(() => mapEquitySeries(data.equity_series ?? []), [data.equity_series]);
  const rCurve = useMemo(() => mapRCurve(trades), [trades]);
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

  const spark = useMemo(() => sparkValues(data.equity_series ?? []), [data.equity_series]);
  const recentClosed = useMemo(
    () =>
      [...trades]
        .filter((t) => t.status === "closed")
        .sort(
          (a, b) =>
            Date.parse(b.exit_timestamp ?? b.trade_timestamp) -
            Date.parse(a.exit_timestamp ?? a.trade_timestamp),
        )
        .slice(0, 12),
    [trades],
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

  const wr = data.win_rate != null ? `${num(data.win_rate, 1)}%` : "—";
  const avgR = data.average_r != null ? `${signed(data.average_r)}R` : data.expectancy_r != null ? `${signed(data.expectancy_r)}R` : "—";
  const maxDd = money(data.max_drawdown, currency);

  return (
    <div className="cc">
      <div className="toolbar">
        <PeriodStrip />
        <p className="muted sample">{data.sample_note ?? `${data.n_trades} closed trades`}</p>
      </div>

      <div className="tos-kpi-grid">
        <MetricCard
          label="Total P&L"
          value={signed(data.total_pnl)}
          tone={tone(data.total_pnl) === "pos" ? "pos" : tone(data.total_pnl) === "neg" ? "neg" : ""}
          hint={currency}
          spark={<MiniSparkline values={spark} height={26} />}
        />
        <MetricCard
          label="Win rate"
          value={wr}
          tone={data.win_rate != null && Number(data.win_rate) >= 50 ? "pos" : data.win_rate != null ? "neg" : ""}
          hint={`${data.n_trades} trades`}
          spark={<MiniSparkline values={spark} height={26} />}
        />
        <MetricCard
          label="Avg R / trade"
          value={avgR}
          tone={
            (data.average_r ?? data.expectancy_r) != null &&
            Number(data.average_r ?? data.expectancy_r) >= 0
              ? "pos"
              : (data.average_r ?? data.expectancy_r) != null
                ? "neg"
                : ""
          }
          hint="Expectancy"
          spark={<MiniSparkline values={spark} height={26} />}
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
                  ["r", "R multiple"],
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
          {mode === "equity" &&
            (equityCurve.length >= 2 ? (
              <EquityCurve curve={equityCurve} currency={currency} height={280} defaultRange="ALL" />
            ) : (
              <p className="empty muted">Close more trades to see equity growth.</p>
            ))}
          {mode === "drawdown" &&
            (ddPoints.length >= 2 ? (
              <UnderwaterCurve curve={ddPoints} currency={currency} height={280} />
            ) : (
              <p className="empty muted">Not enough equity history for drawdown.</p>
            ))}
          {mode === "r" &&
            (rCurve.length >= 2 ? (
              <EquityCurve
                curve={rCurve}
                currency={currency}
                height={280}
                metric="cumulative_r"
                defaultRange="ALL"
              />
            ) : (
              <p className="empty muted">Need closed trades with realized R for this view.</p>
            ))}
        </section>

        <aside className="side">
          <div className="tos-panel recent">
            <h2 className="tos-panel-title">Recent trades</h2>
            {recentClosed.length === 0 ? (
              <p className="muted empty">No closed trades yet.</p>
            ) : (
              <table className="blotter">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>R</th>
                    <th>Result</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClosed.map((t) => (
                    <tr key={t.id} onClick={() => setSelectedId(t.id)}>
                      <td>
                        <strong>{t.symbol}</strong>
                        <span className="dir muted"> {t.direction}</span>
                      </td>
                      <td className={`num ${tone(t.realized_r)}`}>
                        {t.realized_r != null ? `${signed(t.realized_r)}R` : "—"}
                      </td>
                      <td>
                        <span className={`tos-result ${resultClass(t.result)}`}>{t.result || "—"}</span>
                      </td>
                      <td className="muted">{formatWhen(t.exit_timestamp ?? t.trade_timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="tos-panel capacity">
            <h2 className="tos-panel-title">Risk budget</h2>
            <p className="cap-line">
              <strong>{cc.trading_capacity.full_risk_trades_remaining}</strong> full-risk left today
            </p>
            <LimitBar
              label="Personal daily loss"
              limit={data.personal_daily_loss.limit}
              remaining={data.personal_daily_loss.remaining}
            />
            <LimitBar
              label="Max drawdown room"
              limit={data.personal_max_dd.limit}
              remaining={data.personal_max_dd.remaining}
            />
            {openTrades.length > 0 && (
              <p className="muted open-n">
                {openTrades.length} open ·{" "}
                <Link href="/trades?status=open">View</Link>
              </p>
            )}
          </div>
        </aside>
      </div>

      {(cc.edge_snapshot || cc.behaviour_watch || cc.insights.length > 0) && (
        <div className="insight-row">
          {cc.edge_snapshot && (
            <ChartCard title="Edge snapshot">
              <p className="ins-title">{cc.edge_snapshot.label}</p>
              <p className={`num ${tone(cc.edge_snapshot.expectancy_r)}`}>
                {signed(cc.edge_snapshot.expectancy_r)}R · n={cc.edge_snapshot.n}
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
          gap: 16px;
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
          font-size: 12px;
        }
        .main-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
          gap: 14px;
          align-items: start;
        }
        .hero-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .mode-tabs {
          display: inline-flex;
          gap: 4px;
          padding: 3px;
          border-radius: 999px;
          background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .mode-tabs button {
          border: 0;
          background: transparent;
          color: var(--text-muted);
          padding: 5px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }
        .mode-tabs button.active {
          background: var(--accent-soft);
          color: var(--accent);
        }
        .side {
          display: grid;
          gap: 14px;
          min-width: 0;
        }
        .dir {
          font-size: 11px;
          text-transform: uppercase;
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
          margin: 12px 0 0;
          font-size: 13px;
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
      `}</style>
    </div>
  );
}
