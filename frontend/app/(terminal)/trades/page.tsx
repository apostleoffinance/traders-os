"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, getActiveAccountId } from "@/lib/api";
import type { Setup, Trade } from "@/lib/types";
import { Alert, Field, Panel } from "@/components/ui";
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const refreshForAccount = () => setReloadVersion((version) => version + 1);
    window.addEventListener("traderos-account", refreshForAccount);
    return () => window.removeEventListener("traderos-account", refreshForAccount);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api<Setup[]>("/api/setups")
      .then((rows) => {
        if (!cancelled) setSetups(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load trade setups.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [reloadVersion]);

  useEffect(() => {
    let cancelled = false;
    const accountId = getActiveAccountId();
    if (!accountId) {
      setTrades([]);
      return;
    }
    setTrades(null);
    setLoadError(null);
    const q = new URLSearchParams({ account_id: accountId });
    if (session) q.set("session", session);
    if (setupId) q.set("setup_id", setupId);
    if (direction) q.set("direction", direction);
    if (result) q.set("result", result);
    void api<Trade[]>(`/api/trades?${q.toString()}`)
      .then((rows) => {
        if (!cancelled) setTrades(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setTrades([]);
          setLoadError(err instanceof Error ? err.message : "Could not load your journal.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session, setupId, direction, result, reloadVersion]);

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
      {loadError && (
        <div className="load-error">
          <Alert kind="danger">{loadError}</Alert>
          <button type="button" className="btn ghost" onClick={() => setReloadVersion((v) => v + 1)}>
            Try again
          </button>
        </div>
      )}
      <div className="table-wrap">
        {trades == null ? (
          <LoadingState label="Loading your journal…" />
        ) : loadError ? null : rows.length > 0 ? (
          <TradeTable trades={rows} />
        ) : session || setupId || direction || result ? (
          <section className="journal-empty">
            <h2>No trades match these filters</h2>
            <p className="muted">Clear the filters to see your full journal, or log a new trade.</p>
            <div className="empty-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setSession("");
                  setSetupId("");
                  setDirection("");
                  setResult("");
                }}
              >
                Clear filters
              </button>
              <Link href="/trades/new" className="btn primary">New trade</Link>
            </div>
          </section>
        ) : (
          <section className="journal-empty">
            <p className="eyebrow">YOUR JOURNAL STARTS HERE</p>
            <h2>No trades recorded yet</h2>
            <p className="muted">
              Record a trade manually or connect MT5 to import your history. Once trades are captured,
              you can review execution, discipline and performance in one place.
            </p>
            <div className="empty-actions">
              <Link href="/trades/new" className="btn primary">Log your first trade</Link>
              <Link href="/accounts" className="btn ghost">Connect MT5</Link>
            </div>
          </section>
        )}
      </div>
      <style jsx>{`
        .filters {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .load-error {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 12px;
        }
        .table-wrap {
          margin-top: 12px;
        }
        .journal-empty {
          padding: 28px;
          border: 1px solid var(--line);
          border-radius: var(--radius-lg, 14px);
          background: var(--surface, transparent);
        }
        .journal-empty h2 {
          margin: 0 0 8px;
          font-size: 18px;
          font-weight: 650;
        }
        .journal-empty .muted {
          max-width: 58ch;
          margin: 0;
          font-size: 13px;
          line-height: 1.6;
        }
        .eyebrow {
          margin: 0 0 6px;
          color: var(--accent);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
        }
        .empty-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 16px;
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
