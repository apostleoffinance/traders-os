"use client";

import { useEffect, useMemo, useState } from "react";
import { api, getActiveAccountId } from "@/lib/api";
import type { Setup, Trade } from "@/lib/types";
import { Field, Panel } from "@/components/ui";
import { TradeTable } from "@/components/trader/tables/TradeTable";
import { LoadingState } from "@/components/trader/LoadingState";
import { num, signed } from "@/lib/format";

export default function TradeHistoryPage() {
  const [trades, setTrades] = useState<Trade[] | null>(null);
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

  const rows = trades ?? [];
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
      <h1>Trades</h1>
      <p className="muted">
        {trades == null ? (
          <LoadingState label="Loading trades…" />
        ) : (
          <>
            {summary.n} trade{summary.n === 1 ? "" : "s"}
            {summary.open ? ` · ${summary.open} open` : ""}
            {summary.closed ? ` · ${summary.closed} closed` : ""}
            {summary.closed > 0 ? ` · ${signed(summary.totalR, "R")}` : ""}
            {summary.winRate != null ? ` · ${num(summary.winRate, 0)}% win rate (closed)` : ""}
          </>
        )}
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
        {trades == null ? <LoadingState /> : <TradeTable trades={rows} />}
      </div>
      <style jsx>{`
        .filters {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .table-wrap {
          margin-top: 12px;
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
