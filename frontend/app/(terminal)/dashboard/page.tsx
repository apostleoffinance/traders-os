"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, getActiveAccountId, getStoredUser } from "@/lib/api";
import type { Dashboard, Trade, User } from "@/lib/types";
import { Alert, Badge, EmptyState, LimitBar, Panel, Stat } from "@/components/ui";
import { EquitySparkline } from "@/components/EquitySparkline";
import { IntelligenceWidget } from "@/components/IntelligenceWidget";
import { money, num, sessionLabel, signed, tone } from "@/lib/format";
import { firstName, greeting } from "@/lib/theme";

function healthLabel(status: string): string {
  if (status === "green") return "Account healthy";
  if (status === "yellow") return "Caution";
  if (status === "red") return "Risk halt";
  return status;
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [recent, setRecent] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hello, setHello] = useState("Good afternoon");
  const [name, setName] = useState("Trader");

  const load = useCallback(async () => {
    const id = getActiveAccountId();
    if (!id) {
      setError("Create an account to begin.");
      setData(null);
      setRecent([]);
      return;
    }
    setError(null);
    try {
      const dash = await api<Dashboard>(`/api/dashboard?account_id=${id}`);
      setData(dash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
      setData(null);
      return;
    }
    try {
      const trades = await api<Trade[]>(`/api/trades?account_id=${id}`);
      setRecent(trades.slice(0, 8));
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    const stored = getStoredUser() as User | null;
    setHello(greeting());
    setName(firstName(stored?.display_name));
    void load();
    const on = () => void load();
    window.addEventListener("traderos-account", on);
    return () => window.removeEventListener("traderos-account", on);
  }, [load]);

  if (error && !data) {
    return (
      <div>
        <p className="page-kicker">Workspace</p>
        <h1>Dashboard</h1>
        <Alert kind="warn">
          {error} <Link href="/accounts">Open accounts</Link>
        </Alert>
      </div>
    );
  }
  if (!data) return <p className="muted">Loading…</p>;

  const health = data.health ?? {
    score: data.trading_health,
    status: data.trading_health_status,
    trades_needed: data.trading_health_trades_needed,
  };
  const healthInsufficient = health.status === "insufficient_data";
  const pnlPct =
    Number(data.starting_balance) > 0
      ? (Number(data.total_pnl) / Number(data.starting_balance)) * 100
      : null;

  return (
    <div>
      <div className="head">
        <div>
          <p className="page-kicker">{hello}, {name}</p>
          <h1 style={{ margin: 0 }}>{data.account.name}</h1>
          <p className="muted">
            {data.account.firm} · {data.account.program}
          </p>
        </div>
        <div className="head-right">
          <Badge status={data.risk_status} />
          <span className="muted status-copy">{healthLabel(data.risk_status)}</span>
          <div className="hero-eq">
            <div className={`num eq ${tone(data.total_pnl)}`}>{money(data.equity)}</div>
            <div className={`num ${tone(data.total_pnl)}`}>
              {signed(data.total_pnl)}
              {pnlPct != null ? ` · ${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%` : ""}
            </div>
          </div>
        </div>
      </div>

      {data.n_trades === 0 && (
        <EmptyState
          title="Log your first trade"
          action={
            <Link href="/trades/new" className="btn">
              New trade
            </Link>
          }
        >
          <p className="muted" style={{ margin: 0 }}>
            Journal after you analyze on your chart. Risk and discipline are scored here - not in the market.
          </p>
        </EmptyState>
      )}

      {data.risk_reasons.slice(0, 3).map((r) => (
        <Alert key={r} kind={data.risk_status === "red" ? "danger" : data.risk_status === "yellow" ? "warn" : "info"}>
          {r}
        </Alert>
      ))}

      <Panel title="Equity curve">
        <div className="equity-head">
          <Stat label="Equity" value={money(data.equity)} tone={tone(data.total_pnl)} />
          <Stat label="Daily P/L" value={signed(data.daily_pnl)} tone={tone(data.daily_pnl)} />
          <Stat label="Total P/L" value={signed(data.total_pnl)} tone={tone(data.total_pnl)} />
          <Stat label="Drawdown" value={money(data.drawdown)} tone={Number(data.drawdown) > 0 ? "neg" : ""} />
        </div>
        <EquitySparkline series={data.equity_series ?? []} height={140} />
      </Panel>

      <div className="kpi-grid" style={{ margin: "16px 0" }}>
        <Stat label="Win rate" value={data.win_rate ? `${num(data.win_rate, 1)}%` : "-"} />
        <Stat label="Expectancy" value={data.expectancy_r ? `${num(data.expectancy_r)}R` : "-"} />
        <Stat label="Average R" value={data.average_r ? `${num(data.average_r)}R` : "-"} />
        <Stat label="Profit factor" value={data.profit_factor ? num(data.profit_factor) : "-"} />
        <Stat label="Trades" value={data.n_trades} />
        {healthInsufficient ? (
          <Stat
            label="Trading health"
            value="-"
            hint={`${health.trades_needed} more trade${health.trades_needed === 1 ? "" : "s"} to score`}
          />
        ) : (
          <Stat label="Trading health" value={`${health.score}/100`} hint={`based on ${data.n_trades} trades`} />
        )}
        <Stat
          label="Trades today"
          value={`${data.trades_today} / ${data.max_trades_per_day}`}
          tone={data.trades_today >= data.max_trades_per_day ? "warn" : ""}
        />
        <Stat label="Discipline" value={data.discipline_score ?? "-"} />
      </div>

      <div className="two">
        <Panel title="Am I safe?">
          <LimitBar label="Personal daily loss" limit={data.personal_daily_loss.limit} remaining={data.personal_daily_loss.remaining} />
          <LimitBar label="Personal max drawdown" limit={data.personal_max_dd.limit} remaining={data.personal_max_dd.remaining} />
          <LimitBar label="Firm daily drawdown" limit={data.firm_daily_dd.limit} remaining={data.firm_daily_dd.remaining} />
          <LimitBar label="Firm max drawdown" limit={data.firm_max_dd.limit} remaining={data.firm_max_dd.remaining} />
        </Panel>
        <Panel title="How am I doing?">
          {data.n_trades === 0 ? (
            <p>No journaled trades yet. Log a trade to see how you are doing.</p>
          ) : (
            <p>{data.trading_health_summary}</p>
          )}
        </Panel>
      </div>

      <div className="two" style={{ marginTop: 16 }}>
        <Panel
          title="Recent performance"
          right={
            <Link href="/trades" className="muted">
              History
            </Link>
          }
        >
          {recent.length === 0 ? (
            <p className="muted">No trades yet.</p>
          ) : (
            <table className="blotter">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Setup</th>
                  <th>Result</th>
                  <th>R</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => (
                  <tr key={t.id} onClick={() => router.push(`/trades/${t.id}`)}>
                    <td>{sessionLabel(t.session)}</td>
                    <td>{t.setup_name ?? t.symbol}</td>
                    <td>
                      <Badge status={t.result} />
                    </td>
                    <td className={`num ${tone(t.realized_r)}`}>{t.realized_r ? `${num(t.realized_r)}R` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <IntelligenceWidget />
      </div>

      <style jsx>{`
        .head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          gap: 16px;
        }
        .head-right {
          text-align: right;
          display: grid;
          justify-items: end;
          gap: 6px;
        }
        .status-copy {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .eq {
          font-size: 34px;
          font-weight: 700;
        }
        .equity-head {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 10px;
        }
        .two {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 16px;
        }
        @media (max-width: 900px) {
          .head {
            flex-direction: column;
          }
          .head-right {
            text-align: left;
            justify-items: start;
          }
          .two,
          .equity-head {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 640px) {
          .equity-head {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}
