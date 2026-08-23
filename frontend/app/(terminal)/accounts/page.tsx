"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setActiveAccountId } from "@/lib/api";
import type { Account } from "@/lib/types";
import { Alert, Button, Field, Panel } from "@/components/ui";
import { money } from "@/lib/format";

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [template, setTemplate] = useState("tentrade_tenedge_1k");
  const [firm, setFirm] = useState("TenTrade");
  const [program, setProgram] = useState("TenEdge Instant");
  const [name, setName] = useState("TenTrade TenEdge Instant $1K");
  const [balance, setBalance] = useState("1000");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setAccounts(await api<Account[]>("/api/accounts"));
  }

  useEffect(() => {
    void load();
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
      router.push(`/accounts/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
    }
  }

  return (
    <div>
      <p className="page-kicker">Account</p>
      <h1>Accounts</h1>
      <p className="muted">Each account has its own balance, risk policy, trades and analytics. Accounts are never mixed.</p>
      <div className="layout">
        <Panel title="Existing">
          {accounts.length === 0 && <p className="muted">No accounts yet.</p>}
          <ul>
            {accounts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="row"
                  onClick={() => {
                    setActiveAccountId(a.id);
                    router.push(`/accounts/${a.id}`);
                  }}
                >
                  <strong>{a.account_name}</strong>
                  <span className="muted">
                    {a.firm} · {a.program}
                  </span>
                  <span className="num">{money(a.current_equity)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="New account">
          {error && <Alert kind="danger">{error}</Alert>}
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
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .row {
          width: 100%;
          text-align: left;
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--line);
          padding: 10px 0;
          display: grid;
          gap: 2px;
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
