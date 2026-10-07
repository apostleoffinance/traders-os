"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { RiskProfile } from "@/lib/types";
import { Alert, Button, Field, Panel } from "@/components/ui";

function isNoFirmDailyLimit(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (trimmed === "" || /^none$/i.test(trimmed)) return true;
  const n = Number(trimmed);
  return !Number.isNaN(n) && n === 0;
}

function firmDailyLimitDisplayValue(value: string | null | undefined): string {
  return isNoFirmDailyLimit(value) ? "" : String(value);
}

function firmDailyLimitPayloadValue(value: string | null | undefined): string {
  return isNoFirmDailyLimit(value) ? "0" : String(value).trim();
}

export function RiskPolicyForm({
  accountId,
  initial,
}: {
  accountId: string;
  initial: Partial<RiskProfile> | null | undefined;
}) {
  const [form, setForm] = useState<Partial<RiskProfile>>(initial ?? {});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial ?? {});
  }, [initial]);

  function set<K extends keyof RiskProfile>(key: K, value: RiskProfile[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await api(`/api/accounts/${accountId}/risk-profile`, {
        method: "PUT",
        body: JSON.stringify({
          risk_per_trade: form.risk_per_trade,
          personal_daily_loss_limit: form.personal_daily_loss_limit,
          personal_max_drawdown: form.personal_max_drawdown,
          firm_daily_drawdown_limit: firmDailyLimitPayloadValue(form.firm_daily_drawdown_limit),
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

  return (
    <Panel title="Risk limits">
      <p className="muted">These values live on the account. Personal limits should stay stricter than firm limits.</p>
      {error && <Alert kind="danger">{error}</Alert>}
      {saved && <Alert kind="info">Risk limits saved.</Alert>}
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
        <Field label="Firm daily drawdown (blank = none)">
          <input
            placeholder="None"
            value={firmDailyLimitDisplayValue(form.firm_daily_drawdown_limit)}
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
          <Button type="submit">Save limits</Button>
        </div>
      </form>
      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
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
    </Panel>
  );
}
