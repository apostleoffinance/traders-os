"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { api, getActiveAccountId } from "@/lib/api";
import type { Setup, Trade } from "@/lib/types";
import { Badge, Field, Panel } from "@/components/ui";
import { formatDate, formatTime, money, num, sessionLabel, signed, tone } from "@/lib/format";

function TradeRow({ trade: t }: { trade: Trade }) {
  const href = `/trades/${t.id}`;
  const cells: { content: ReactNode; className?: string }[] = [
    { content: formatDate(t.trade_timestamp) },
    { content: formatTime(t.trade_timestamp), className: "num" },
    {
      content: (
        <Link href={href} className="cell-link">
          {t.symbol}
        </Link>
      ),
      className: "num",
    },
    { content: sessionLabel(t.session) },
    { content: t.direction },
    { content: t.setup_name ?? "-" },
    { content: t.entry_price, className: "num" },
    { content: t.stop_loss, className: "num" },
    { content: t.take_profit ?? "-", className: "num" },
    { content: t.lot_size, className: "num" },
    { content: money(t.risk_amount), className: "num" },
    { content: <Badge status={t.status} /> },
    { content: <Badge status={t.result} /> },
    {
      content: t.status === "open" ? "—" : (t.realized_r ?? "-"),
      className: `num ${tone(t.realized_r)}`,
    },
    {
      content: t.status === "open" ? "—" : signed(t.realized_pnl),
      className: `num ${tone(t.realized_pnl)}`,
    },
    { content: t.discipline_score ?? "-", className: "num" },
    { content: t.psychology?.emotion_before ?? "-" },
  ];

  return (
    <tr className="trade-row">
      {cells.map((cell, i) => (
        <td key={i} className={cell.className}>
          <Link
            href={href}
            className="row-hit"
            aria-label={i === 0 ? `Open ${t.symbol} trade` : undefined}
            aria-hidden={i === 0 ? undefined : true}
            tabIndex={i === 0 ? 0 : -1}
          />
          {cell.content}
        </td>
      ))}
      <td className="actions">
        <Link href={href} className="open-link">
          Open
        </Link>
      </td>
    </tr>
  );
}

export default function TradeHistoryPage() {
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
    const closed = rows.filter((t) => t.status === "closed");
    const open = rows.filter((t) => t.status === "open").length;
    const wins = closed.filter((t) => t.result === "win").length;
    const totalR = closed.reduce((s, t) => s + (t.realized_r ? Number(t.realized_r) : 0), 0);
    const winRate = closed.length ? (wins / closed.length) * 100 : null;
    return { n: rows.length, closed: closed.length, open, totalR, winRate };
  }, [rows]);

  return (
    <div>
      <p className="page-kicker">Workspace</p>
      <h1>Trade history</h1>
      <p className="muted">
        {summary.n} trade{summary.n === 1 ? "" : "s"}
        {summary.open ? ` · ${summary.open} open` : ""}
        {summary.closed ? ` · ${summary.closed} closed` : ""}
        {summary.closed > 0 ? ` · ${signed(summary.totalR, "R")}` : ""}
        {summary.winRate != null ? ` · ${num(summary.winRate, 0)}% win rate (closed)` : ""}
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
              <th>Status</th>
              <th>Result</th>
              <th>R</th>
              <th>P/L</th>
              <th>Disc.</th>
              <th>Emotion</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <TradeRow key={t.id} trade={t} />
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
          position: relative;
          padding: 8px;
          border-bottom: 1px solid var(--line);
          white-space: nowrap;
        }
        .trade-row:hover td {
          background: var(--surface-2);
        }
        .trade-row :global(.row-hit) {
          position: absolute;
          inset: 0;
          z-index: 1;
        }
        .trade-row :global(.cell-link),
        .trade-row :global(.open-link) {
          position: relative;
          z-index: 2;
          color: inherit;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .trade-row :global(.open-link) {
          color: var(--accent);
          font-weight: 600;
        }
        .actions {
          text-align: right;
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
