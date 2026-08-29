"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setActiveAccountId } from "@/lib/api";
import { fetchMt5Connections, mt5NeedsSetup, mt5StatusLabel } from "@/lib/mt5";
import type { Account, Mt5Connection } from "@/lib/types";
import { Alert, Button, Field, Panel } from "@/components/ui";
import { money } from "@/lib/format";

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [mt5ByAccount, setMt5ByAccount] = useState<Record<string, Mt5Connection>>({});
  const [template, setTemplate] = useState("tentrade_tenedge_1k");
  const [firm, setFirm] = useState("TenTrade");
  const [program, setProgram] = useState("TenEdge Instant");
  const [name, setName] = useState("TenTrade TenEdge Instant $1K");
  const [balance, setBalance] = useState("1000");
  const [error, setError] = useState<string | null>(null);

  const anyLive = useMemo(
    () => Object.values(mt5ByAccount).some((c) => c.status === "connected"),
    [mt5ByAccount],
  );

  async function load() {
    const [rows, connections] = await Promise.all([
      api<Account[]>("/api/accounts"),
      fetchMt5Connections().catch(() => [] as Mt5Connection[]),
    ]);
    setAccounts(rows);
    const map: Record<string, Mt5Connection> = {};
    for (const c of connections) {
      if (c.status !== "revoked") map[c.account_id] = c;
    }
    setMt5ByAccount(map);
  }

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : "Could not load accounts");
    });
  }, []);

  function applyTemplate(key: string) {
    setTemplate(key);
    if (key === "tentrade_tenedge_1k") {
      setFirm("TenTrade");
      setProgram("TenEdge Instant");
      setName("TenTrade TenEdge Instant $1K");
      setBalance("1000");
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await api<Account>("/api/accounts", {
        method: "POST",
        body: JSON.stringify({
          firm,
          program,
          account_name: name,
          currency: "USD",
          starting_balance: balance,
          template: template || null,
        }),
      });
      setActiveAccountId(created.id);
      await load();
      router.push(`/accounts/${created.id}?connect=mt5`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    }
  }

  function openAccount(id: string, connectMt5 = false) {
    setActiveAccountId(id);
    router.push(connectMt5 ? `/accounts/${id}?connect=mt5` : `/accounts/${id}`);
  }

  return (
    <div>
      <p className="page-kicker">Account</p>
      <h1>Accounts</h1>
      <p className="muted">Each account has its own balance, risk policy, trades and analytics. Accounts are never mixed.</p>

      <Panel title="MetaTrader 5 sync">
        <p className="muted">
          Connect MT5 once per journal account to import trades automatically. Open an account below,
          then use <strong>Connect MT5</strong> for the setup guide and EA download.
        </p>
        {anyLive ? (
          <p className="live-note">At least one account has live MT5 sync enabled.</p>
        ) : accounts.length > 0 ? (
          <p className="muted">No accounts are syncing from MT5 yet.</p>
        ) : null}
      </Panel>

      <div className="layout">
        <Panel title="Existing">
          {error && <Alert kind="danger">{error}</Alert>}
          {accounts.length === 0 && <p className="muted">No accounts yet.</p>}
          <ul>
            {accounts.map((a) => {
              const mt5 = mt5ByAccount[a.id];
              const status = mt5?.status;
              return (
                <li key={a.id}>
                  <button type="button" className="row" onClick={() => openAccount(a.id)}>
                    <div className="row-head">
                      <strong>{a.account_name}</strong>
                      {mt5 && (
                        <span
                          className={`mt5-pill ${status === "connected" ? "live" : status === "stale" ? "stale" : "setup"}`}
                        >
                          {mt5StatusLabel(status)}
                        </span>
                      )}
                    </div>
                    <span className="muted">
                      {a.firm} · {a.program}
                    </span>
                    <span className="num">{money(a.current_equity)}</span>
                  </button>
                  {(!mt5 || mt5NeedsSetup(status)) && (
                    <button type="button" className="connect-link" onClick={() => openAccount(a.id, true)}>
                      Connect MT5 →
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel title="New account">
          <form onSubmit={onCreate}>
            <Field label="Template">
              <select value={template} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="tentrade_tenedge_1k">TenTrade TenEdge Instant $1K</option>
                <option value="">Custom</option>
              </select>
            </Field>
            <Field label="Firm">
              <input value={firm} onChange={(e) => setFirm(e.target.value)} required />
            </Field>
            <Field label="Program">
              <input value={program} onChange={(e) => setProgram(e.target.value)} />
            </Field>
            <Field label="Account name">
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Starting balance (USD)">
              <input type="number" step="0.01" min="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} />
            </Field>
            <Button type="submit">Create account</Button>
          </form>
        </Panel>
      </div>
      <style jsx>{`
        .layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 16px;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        li {
          border-bottom: 1px solid var(--line);
        }
        .row {
          width: 100%;
          text-align: left;
          background: transparent;
          border: 0;
          padding: 10px 0;
          display: grid;
          gap: 2px;
          cursor: pointer;
        }
        .row-head {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .mt5-pill {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          padding: 2px 6px;
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
        }
        .mt5-pill.live {
          border-color: var(--accent);
          color: var(--accent);
        }
        .mt5-pill.stale {
          border-color: var(--warn);
          color: var(--warn);
        }
        .mt5-pill.setup {
          color: var(--muted);
        }
        .connect-link {
          background: none;
          border: 0;
          padding: 0 0 10px;
          color: var(--accent);
          font-size: 0.9rem;
          cursor: pointer;
        }
        .live-note {
          margin: 8px 0 0;
          color: var(--accent);
          font-size: 0.9rem;
        }
        form {
          display: grid;
          gap: 10px;
        }
        @media (max-width: 800px) {
          .layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
