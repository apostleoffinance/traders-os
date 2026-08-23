"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getActiveAccountId } from "@/lib/api";
import type { RiskStatus } from "@/lib/types";
import { Alert, Badge, Panel, Stat } from "@/components/ui";
import { money, num } from "@/lib/format";

function statusCopy(status: string): string {
  if (status === "green") return "Within personal and firm limits";
  if (status === "yellow") return "Approaching a configured limit";
  if (status === "red") return "Risk policy halt - do not increase size";
  return status;
}

export default function RiskPage() {
  const [data, setData] = useState<RiskStatus | null>(null);

  const load = useCallback(async () => {
    const id = getActiveAccountId();
    if (!id) return;
    setData(await api<RiskStatus>(`/api/risk/status?account_id=${id}`));
  }, []);

  useEffect(() => {
    void load();
    window.addEventListener("traderos-account", load);
    return () => window.removeEventListener("traderos-account", load);
  }, [load]);

  if (!data) return <p className="muted">Select an account to view risk.</p>;

  return (
    <div>
      <div className="head">
        <div>
          <p className="page-kicker">Risk</p>
          <h1>Risk monitor</h1>
          <p className="muted">
            Personal limits are stricter than firm limits. The system will not encourage you to trade through a halt.
          </p>
        </div>
        <div className="head-right">
          <Badge status={data.status} />
          <span className="muted copy">{statusCopy(data.status)}</span>
        </div>
      </div>
      {data.reasons.map((r) => (
        <Alert key={r} kind={data.status === "red" ? "danger" : data.status === "yellow" ? "warn" : "info"}>
          {r}
        </Alert>
      ))}
      <div className="kpi-grid" style={{ margin: "16px 0" }}>
        <Stat label="Daily P/L" value={money(data.daily_pnl)} tone={Number(data.daily_pnl) < 0 ? "neg" : Number(data.daily_pnl) > 0 ? "pos" : ""} />
        <Stat label="Daily risk deployed" value={money(data.daily_risk)} />
        <Stat label="Trades today" value={data.trades_today} />
        <Stat label="Consecutive losses" value={data.consecutive_losses} tone={data.consecutive_losses >= 3 ? "warn" : ""} />
        <Stat label="Current drawdown" value={money(data.current_drawdown)} tone={Number(data.current_drawdown) > 0 ? "neg" : ""} />
        <Stat label="Max drawdown" value={money(data.max_drawdown)} />
        <Stat label="Avg risk (last N)" value={data.avg_risk_last_n ? money(data.avg_risk_last_n) : "-"} />
        <Stat
          label="Risk escalation"
          value={data.risk_escalation_pct ? `${num(Number(data.risk_escalation_pct) * 100, 0)}%` : "-"}
          tone={data.risk_escalation_pct && Number(data.risk_escalation_pct) > 0 ? "warn" : ""}
        />
      </div>
      <Panel title="Distance to limits">
        <p className="muted">Remaining room before each halt. Green in the product means safety, not permission to size up after losses.</p>
        <table className="blotter">
          <thead>
            <tr>
              <th>Limit</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Personal daily loss</td>
              <td className="num">{money(data.distance_to_personal_daily_loss)}</td>
            </tr>
            <tr>
              <td>Personal max drawdown</td>
              <td className="num">{money(data.distance_to_personal_max_dd)}</td>
            </tr>
            <tr>
              <td>Firm daily drawdown</td>
              <td className="num">{money(data.distance_to_firm_daily_dd)}</td>
            </tr>
            <tr>
              <td>Firm max drawdown</td>
              <td className="num">{money(data.distance_to_firm_max_dd)}</td>
            </tr>
          </tbody>
        </table>
      </Panel>
      {data.events.length > 0 && (
        <Panel title="Events">
          <ul>
            {data.events.map((e, i) => (
              <li key={`${e.event_type}-${i}`}>
                <Badge status={e.severity} /> {e.message}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <style jsx>{`
        .head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }
        .head-right {
          display: grid;
          justify-items: end;
          gap: 6px;
        }
        .copy {
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-align: right;
          max-width: 220px;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}
