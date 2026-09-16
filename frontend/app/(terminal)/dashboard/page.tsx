"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, getActiveAccountId, getStoredUser } from "@/lib/api";
import type { Dashboard, Trade, User } from "@/lib/types";
import { Alert, EmptyState } from "@/components/ui";
import { CommandCenterView } from "@/components/command-center/CommandCenterView";
import { firstName, greeting } from "@/lib/theme";

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hello, setHello] = useState("Good afternoon");
  const [name, setName] = useState("Trader");

  const load = useCallback(async () => {
    const id = getActiveAccountId();
    if (!id) {
      setError("Create an account to begin.");
      setData(null);
      setTrades([]);
      return;
    }
    setError(null);
    try {
      const dash = await api<Dashboard>(`/api/dashboard?account_id=${id}`);
      setData(dash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load command center.");
      setData(null);
      return;
    }
    try {
      const list = await api<Trade[]>(`/api/trades?account_id=${id}`);
      setTrades(list);
    } catch {
      setTrades([]);
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
        <h1>Home</h1>
        <Alert kind="warn">
          {error} <Link href="/accounts">Open accounts</Link>
        </Alert>
      </div>
    );
  }
  if (!data) return <p className="muted">Loading…</p>;

  const openTrades = trades.filter((t) => t.status === "open");

  return (
    <div>
      <header className="cc-head">
        <div>
          <h1 style={{ margin: "0 0 4px" }}>
            {hello}, {name}.
          </h1>
          <p className="lede">Here&apos;s what&apos;s happening with your trading.</p>
        </div>
        <div className="actions">
          <Link href="/trades/new" className="btn primary">
            New trade
          </Link>
          <Link href="/analytics" className="btn ghost">
            Analytics
          </Link>
        </div>
      </header>

      {data.n_trades === 0 && (
        <EmptyState
          title="No trades yet"
          action={
            <Link href="/trades/new" className="btn">
              Log first trade
            </Link>
          }
        >
          <p className="muted" style={{ margin: 0 }}>
            Connect MT5 from Accounts to sync trades automatically.
          </p>
        </EmptyState>
      )}

      <CommandCenterView data={data} trades={trades} openTrades={openTrades} />

      <style jsx>{`
        .cc-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 18px;
        }
        .lede {
          margin: 0;
          color: var(--text-secondary);
          font-size: 14px;
          max-width: 52ch;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .actions :global(.btn.primary) {
          background: var(--accent);
          color: var(--accent-contrast);
          border-color: var(--accent);
        }
        @media (max-width: 700px) {
          .cc-head {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
