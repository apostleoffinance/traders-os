"use client";

import { useMemo } from "react";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { MiniSparkline } from "@/components/analytics/primitives/MiniSparkline";
import { MetricCard } from "@/components/trader/MetricCard";
import { money, num, signed, tone } from "@/lib/format";

export type PulseStatus = "positive" | "mixed" | "negative" | "early" | "no_data";

function pulseStatus(
  tradeCount: number,
  netPnl: number,
  winRate: number | null,
  maturity: "empty" | "early" | "mature",
): PulseStatus {
  if (tradeCount <= 0 || maturity === "empty") return "no_data";
  if (maturity === "early") return "early";
  if (netPnl > 0 && (winRate == null || winRate >= 50)) return "positive";
  if (netPnl < 0 && (winRate == null || winRate < 50)) return "negative";
  return "mixed";
}

function statusLabel(status: PulseStatus, netPnl = 0): string {
  switch (status) {
    case "positive":
      return "Positive so far";
    case "mixed":
      return "Mixed results";
    case "negative":
      return "Under pressure";
    case "early":
      if (netPnl > 0) return "Early · positive so far";
      if (netPnl < 0) return "Early · soft so far";
      return "Early data";
    case "no_data":
      return "No closed trades yet";
  }
}

/**
 * Compact “how am I doing?” strip — deterministic overview metrics only.
 */
export function TradingPulse({
  data,
  maturity,
}: {
  data: AnalyticsDashboard;
  maturity: "empty" | "early" | "mature";
}) {
  const o = data.overview;
  const currency = data.account.currency;
  const n = o.n_trades;
  const net = Number(o.net_pnl);
  const wr = o.win_rate != null ? Number(o.win_rate) : null;
  const avgR = o.average_r ?? o.expectancy_r;

  const status = pulseStatus(n, net, wr, maturity);
  const equitySpark = useMemo(
    () => data.equity.slice(-24).map((p) => Number(p.equity)),
    [data.equity],
  );

  const winsHint = useMemo(() => {
    if (wr == null || n <= 0) return `${n} trade${n === 1 ? "" : "s"}`;
    const wins = Math.round((wr / 100) * n);
    const losses = Math.max(0, n - wins);
    return `${n} trades · ${wins} win${wins === 1 ? "" : "s"} · ${losses} loss${losses === 1 ? "" : "es"}`;
  }, [n, wr]);

  const earlyNote =
    maturity === "early" && net > 0
      ? "Positive so far, but still early."
      : maturity === "early" && net < 0
        ? "Early results are soft — keep recording trades."
        : maturity === "early"
          ? "Still early — more trades will clarify the picture."
          : statusLabel(status, net);

  if (n <= 0) return null;

  return (
    <section className="pulse" aria-labelledby="pulse-title">
      <header className="head">
        <h2 id="pulse-title">Trading pulse</h2>
        <span className={`badge status-${status}`} role="status">
          {statusLabel(status, net)}
        </span>
      </header>

      <div className="kpis">
        <MetricCard
          label="Net P&L"
          value={money(o.net_pnl, currency)}
          tone={tone(o.net_pnl)}
          hint={winsHint}
        />
        <MetricCard
          label="Win rate"
          value={wr != null ? `${num(wr, 1)}%` : "—"}
          hint={`${n} trade${n === 1 ? "" : "s"}`}
        />
        <MetricCard
          label="Avg / trade"
          value={avgR != null ? `${signed(avgR)}R` : "—"}
          tone={tone(avgR)}
          hint="Average R"
          spark={equitySpark.length >= 2 ? <MiniSparkline values={equitySpark} height={24} /> : undefined}
        />
      </div>

      <p className="note">{earlyNote}</p>

      <style jsx>{`
        .pulse {
          display: grid;
          gap: 10px;
          padding: 14px 14px 12px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
        }
        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }
        h2 {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent-text, var(--accent));
        }
        .badge {
          font-size: 11px;
          font-weight: 650;
          padding: 3px 8px;
          border-radius: 999px;
          border: 1px solid var(--border);
          color: var(--text-secondary);
          background: var(--surface-2);
        }
        .status-positive {
          color: var(--pos);
          border-color: color-mix(in srgb, var(--pos) 35%, var(--border));
        }
        .status-negative {
          color: var(--neg);
          border-color: color-mix(in srgb, var(--neg) 35%, var(--border));
        }
        .status-early,
        .status-mixed {
          color: var(--text-secondary);
        }
        .kpis {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          align-items: start;
        }
        .kpis :global(.metric-card) {
          min-height: 0;
          padding: 10px 12px;
        }
        .kpis :global(.value) {
          font-size: 1.25rem;
        }
        .note {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 550;
        }
        @media (max-width: 700px) {
          .kpis {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

export function TradingPulseSkeleton() {
  return (
    <div className="skel" aria-hidden>
      <div className="label" />
      <div className="row">
        <div className="card" />
        <div className="card" />
        <div className="card" />
      </div>
      <style jsx>{`
        .skel {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          padding: 14px;
          display: grid;
          gap: 10px;
        }
        .label {
          width: 100px;
          height: 10px;
          border-radius: 4px;
          background: var(--surface-2);
        }
        .row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .card {
          height: 72px;
          border-radius: 8px;
          background: var(--surface-2);
        }
        @media (max-width: 700px) {
          .row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
