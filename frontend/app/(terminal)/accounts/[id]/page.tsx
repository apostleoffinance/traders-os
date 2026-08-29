"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Account, RiskProfile } from "@/lib/types";
import { Alert, Button, Field, Panel } from "@/components/ui";
import { Mt5ConnectionPanel } from "@/components/Mt5ConnectionPanel";
import { money } from "@/lib/format";

export default function AccountDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const connectMt5 = searchParams.get("connect") === "mt5";
  const [account, setAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<Partial<RiskProfile>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const a = await api<Account>(`/api/accounts/${params.id}`);
      setAccount(a);
      setForm(a.risk_profile ?? {});
    })();
  }, [params.id]);

  function set<K extends keyof RiskProfile>(key: K, value: RiskProfile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await api(`/api/accounts/${params.id}/risk-profile`, {
        method: "PUT",
        body: JSON.stringify({
          risk_per_trade: form.risk_per_trade,
          personal_daily_loss_limit: form.personal_daily_loss_limit,
          personal_max_drawdown: form.personal_max_drawdown,
          firm_daily_drawdown_limit: form.firm_daily_drawdown_limit,
          firm_max_drawdown_limit: form.firm_max_drawdown_limit,
          max_trades_per_day: Number(form.max_trades_per_day),
          preferred_min_rr: form.preferred_min_rr,
          preferred_rr: form.preferred_rr,
          minimum_trading_days: Number(form.minimum_trading_days),
          hard_risk_per_trade: form.hard_risk_per_trade || null,
          risk_per_trade_enforcement: form.risk_per_trade_enforcement,
          hard_risk_enforcement: form.hard_risk_enforcement,
          drawdown_basis: form.drawdown_basis,
          preferred_windows: form.preferred_windows ?? [],
          extra_restrictions: form.extra_restrictions ?? {},
          notes: form.notes,
        }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  if (!account) return <p className="muted">Loading…</p>;

  return (
    <div>
      <p className="page-kicker">Account</p>
      <h1>{account.account_name}</h1>
      <p className="muted">
        {account.firm} · {account.program} · starting {money(account.starting_balance)} · equity{" "}
        {money(account.current_equity)}
      </p>
      <Mt5ConnectionPanel accountId={params.id} autoOpen={connectMt5} />
      <Panel title="Risk policy">
        <p className="muted">
          These values live in the database. Personal limits should stay stricter than firm limits.
        </p>
        {error && <Alert kind="danger">{error}</Alert>}
        {saved && <Alert kind="info">Risk policy saved.</Alert>}
        <form onSubmit={onSave} className="grid">
          <Field label="Risk per trade">
            <input value={String(form.risk_per_trade ?? "")} onChange={(e) => set("risk_per_trade", e.target.value)} />
          </Field>
          <Field label="Personal daily loss">
            <input
              value={String(form.personal_daily_loss_limit ?? "")}
              onChange={(e) => set("personal_daily_loss_limit", e.target.value)}
            />
          </Field>
          <Field label="Personal max drawdown">
            <input
              value={String(form.personal_max_drawdown ?? "")}
              onChange={(e) => set("personal_max_drawdown", e.target.value)}
            />
          </Field>
          <Field label="Firm daily drawdown">
            <input
              value={String(form.firm_daily_drawdown_limit ?? "")}
              onChange={(e) => set("firm_daily_drawdown_limit", e.target.value)}
            />
          </Field>
          <Field label="Firm max drawdown">
            <input
              value={String(form.firm_max_drawdown_limit ?? "")}
              onChange={(e) => set("firm_max_drawdown_limit", e.target.value)}
            />
          </Field>
          <Field label="Max trades / day">
            <input
              type="number"
              value={String(form.max_trades_per_day ?? "")}
              onChange={(e) => set("max_trades_per_day", Number(e.target.value))}
            />
          </Field>
          <Field label="Preferred min R:R">
            <input value={String(form.preferred_min_rr ?? "")} onChange={(e) => set("preferred_min_rr", e.target.value)} />
          </Field>
          <Field label="Preferred R:R">
            <input value={String(form.preferred_rr ?? "")} onChange={(e) => set("preferred_rr", e.target.value)} />
          </Field>
          <Field label="Minimum trading days">
            <input
              type="number"
              value={String(form.minimum_trading_days ?? "")}
              onChange={(e) => set("minimum_trading_days", Number(e.target.value))}
            />
          </Field>
          <Field label="Hard risk cap (block)">
            <input
              value={String(form.hard_risk_per_trade ?? "")}
              onChange={(e) => set("hard_risk_per_trade", e.target.value)}
            />
          </Field>
          <Field label="Over-unit enforcement">
            <select
              value={form.risk_per_trade_enforcement}
              onChange={(e) => set("risk_per_trade_enforcement", e.target.value)}
            >
              <option value="warn">Warn</option>
              <option value="confirm">Require confirmation</option>
              <option value="block">Block</option>
            </select>
          </Field>
          <Field label="Hard cap enforcement">
            <select value={form.hard_risk_enforcement} onChange={(e) => set("hard_risk_enforcement", e.target.value)}>
              <option value="warn">Warn</option>
              <option value="confirm">Require confirmation</option>
              <option value="block">Block</option>
            </select>
          </Field>
          <div className="span">
            <Button type="submit">Save policy</Button>
          </div>
        </form>
      </Panel>
      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        .span {
          grid-column: 1 / -1;
        }
        @media (max-width: 800px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
