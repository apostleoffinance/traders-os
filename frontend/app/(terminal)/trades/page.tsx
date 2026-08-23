"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getActiveAccountId } from "@/lib/api";
import type { Setup, Trade } from "@/lib/types";
import { Badge, Field, Panel } from "@/components/ui";
import { formatDate, formatTime, money, num, sessionLabel, signed, tone } from "@/lib/format";

export default function TradeHistoryPage() {
  const router = useRouter();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [setups, setSetups] = useState<Setup[]>([]);
  const [session, setSession] = useState("");
  const [setupId, setSetupId] = useState("");
  const [direction, setDirection] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    void (async () => {
      setSetups(await api<Setup[]>("/api/setups"));
    })();
  }, []);

  useEffect(() => {
    const accountId = getActiveAccountId();
    if (!accountId) return;
    const q = new URLSearchParams({ account_id: accountId });
    if (session) q.set("session", session);
    if (setupId) q.set("setup_id", setupId);
    if (direction) q.set("direction", direction);
    if (result) q.set("result", result);
    void api<Trade[]>(`/api/trades?${q.toString()}`).then(setTrades);
  }, [session, setupId, direction, result]);

  const rows = useMemo(() => trades, [trades]);
  const summary = useMemo(() => {
    const closed = rows.filter((t) => t.result && t.result !== "open");
    const wins = closed.filter((t) => t.result === "win").length;
    const totalR = closed.reduce((s, t) => s + (t.realized_r ? Number(t.realized_r) : 0), 0);
    const winRate = closed.length ? (wins / closed.length) * 100 : null;
    return { n: rows.length, totalR, winRate };
  }, [rows]);

  return (
    <div>
      <p className="page-kicker">Workspace</p>
      <h1>Trade history</h1>
      <p className="muted">
        {summary.n} trade{summary.n === 1 ? "" : "s"}
        {summary.n > 0 ? ` · ${signed(summary.totalR, "R")}` : ""}
        {summary.winRate != null ? ` · ${num(summary.winRate, 0)}% win rate` : ""}
      </p>
      <Panel title="Filters">
        <div className="filters">
          <Field label="Session">
            <select value={session} onChange={(e) => setSession(e.target.value)}>
              <option value="">All</option>
              <option value="london">London</option>
              <option value="london_ny_overlap">London/NY</option>
              <option value="new_york">New York</option>
              <option value="asia">Asia</option>
              <option value="outside">Outside</option>
            </select>
          </Field>
          <Field label="Setup">
            <select value={setupId} onChange={(e) => setSetupId(e.target.value)}>
              <option value="">All</option>
              {setups.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Direction">
            <select value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="">All</option>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </Field>
          <Field label="Result">
            <select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="">All</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="breakeven">Breakeven</option>
              <option value="open">Open</option>
            </select>
          </Field>
        </div>
      </Panel>
      <div className="table-wrap">
        <table className="blotter">
          <thead>
            <tr>
              <th>Date</th>
              <th>Time</th>
              <th>Instrument</th>
              <th>Session</th>
              <th>Dir</th>
              <th>Setup</th>
              <th>Entry</th>
              <th>SL</th>
              <th>TP</th>
              <th>Lot</th>
              <th>Risk</th>
              <th>Result</th>
              <th>R</th>
              <th>P/L</th>
              <th>Disc.</th>
              <th>Emotion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} onClick={() => router.push(`/trades/${t.id}`)}>
                <td>{formatDate(t.trade_timestamp)}</td>
                <td className="num">{formatTime(t.trade_timestamp)}</td>
                <td className="num">{t.symbol}</td>
                <td>{sessionLabel(t.session)}</td>
                <td>{t.direction}</td>
                <td>{t.setup_name ?? "-"}</td>
                <td className="num">{t.entry_price}</td>
                <td className="num">{t.stop_loss}</td>
                <td className="num">{t.take_profit ?? "-"}</td>
                <td className="num">{t.lot_size}</td>
                <td className="num">{money(t.risk_amount)}</td>
                <td>
                  <Badge status={t.result} />
                </td>
                <td className={`num ${tone(t.realized_r)}`}>{t.realized_r ?? "-"}</td>
                <td className={`num ${tone(t.realized_pnl)}`}>{signed(t.realized_pnl)}</td>
                <td className="num">{t.discipline_score ?? "-"}</td>
                <td>{t.psychology?.emotion_before ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted">No trades for these filters.</p>}
      </div>
      <style jsx>{`
        .filters {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .table-wrap {
          margin-top: 12px;
          overflow: auto;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: var(--radius);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }
        th {
          text-align: left;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
          padding: 8px;
          border-bottom: 1px solid var(--line);
          white-space: nowrap;
        }
        td {
          padding: 8px;
          border-bottom: 1px solid var(--line);
          white-space: nowrap;
          cursor: pointer;
        }
        tr:hover td {
          background: var(--surface-2);
        }
        @media (max-width: 800px) {
          .filters {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}
