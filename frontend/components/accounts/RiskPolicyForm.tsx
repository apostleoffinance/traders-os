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

function amount(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validatePolicy(form: Partial<RiskProfile>): string | null {
  const positiveFields: Array<[keyof RiskProfile, string]> = [
    ["risk_per_trade", "Risk per trade"],
    ["personal_daily_loss_limit", "Personal daily loss"],
    ["personal_max_drawdown", "Personal max drawdown"],
    ["firm_max_drawdown_limit", "Firm max drawdown"],
    ["preferred_min_rr", "Preferred minimum R:R"],
    ["preferred_rr", "Preferred R:R"],
  ];
  for (const [key, label] of positiveFields) {
    const value = amount(form[key]);
    if (value === null || value <= 0) return `${label} must be a number greater than zero.`;
  }

  const risk = amount(form.risk_per_trade)!;
  const hardCap = amount(form.hard_risk_per_trade);
  const personalDaily = amount(form.personal_daily_loss_limit)!;
  const firmDaily = amount(form.firm_daily_drawdown_limit);
  const personalDrawdown = amount(form.personal_max_drawdown)!;
  const firmDrawdown = amount(form.firm_max_drawdown_limit)!;
  const minRr = amount(form.preferred_min_rr)!;
  const preferredRr = amount(form.preferred_rr)!;

  if (form.hard_risk_per_trade != null && String(form.hard_risk_per_trade).trim() !== "" && (hardCap === null || hardCap <= 0)) {
    return "Hard risk cap must be blank or a number greater than zero.";
  }
  if (hardCap !== null && risk >= hardCap) return "Risk per trade must be below the hard risk cap.";
  if (personalDrawdown >= firmDrawdown) return "Personal max drawdown must be below the firm max drawdown.";
  if (firmDaily !== null && firmDaily > 0 && personalDaily >= firmDaily) {
    return "Personal daily loss must be below the firm daily drawdown.";
  }
  if (preferredRr < minRr) return "Preferred R:R must be greater than or equal to the minimum R:R.";

  const maxTrades = Number(form.max_trades_per_day);
  if (!Number.isInteger(maxTrades) || maxTrades < 1) return "Max trades per day must be a whole number of at least 1.";
  const minimumDays = Number(form.minimum_trading_days);
  if (!Number.isInteger(minimumDays) || minimumDays < 0) return "Minimum trading days must be a whole number of zero or more.";
  return null;
}

function readableMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim() && !value.includes("[object Object]")) return value;
  if (Array.isArray(value)) {
    const parts = value.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const entry = item as Record<string, unknown>;
        const msg = entry.msg ?? entry.message ?? entry.detail;
        if (typeof msg === "string") return msg;
        const loc = Array.isArray(entry.loc) ? entry.loc.filter((part) => typeof part === "string").join(".") : "";
        return loc ? `${loc}: invalid value` : null;
      }
      return null;
    }).filter((item): item is string => Boolean(item));
    if (parts.length) return parts.join(" ");
  }
  return null;
}

function readableError(error: unknown): string {
  if (typeof error === "string") {
    const message = readableMessage(error);
    if (message) return message;
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const fromError = error instanceof Error ? readableMessage(error.message) : null;
    if (fromError) return fromError;
    // ApiError keeps the original response body; inspect it if its message was
    // serialized poorly by an upstream layer.
    const body = record.body && typeof record.body === "object" ? record.body as Record<string, unknown> : null;
    if (body) {
      const fromBody = readableMessage(body.message) ?? readableMessage(body.detail);
      if (fromBody) return fromBody;
    }
    const message = readableMessage(record.message) ?? readableMessage(record.detail);
    if (message) return message;
  }
  return "Trader OS could not save these risk limits. Check the values and try again.";
}

export function RiskPolicyForm({
  accountId,
  currency = "account currency",
  initial,
}: {
  accountId: string;
  currency?: string;
  initial: Partial<RiskProfile> | null | undefined;
}) {
  const [form, setForm] = useState<Partial<RiskProfile>>(initial ?? {});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initial ?? {});
  }, [initial]);

  function set<K extends keyof RiskProfile>(key: K, value: RiskProfile[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const validationError = validatePolicy(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        risk_per_trade: String(form.risk_per_trade).trim(),
        personal_daily_loss_limit: String(form.personal_daily_loss_limit).trim(),
        personal_max_drawdown: String(form.personal_max_drawdown).trim(),
        firm_daily_drawdown_limit: firmDailyLimitPayloadValue(form.firm_daily_drawdown_limit),
        firm_max_drawdown_limit: String(form.firm_max_drawdown_limit).trim(),
        max_trades_per_day: Number(form.max_trades_per_day),
        preferred_min_rr: String(form.preferred_min_rr).trim(),
        preferred_rr: String(form.preferred_rr).trim(),
        minimum_trading_days: Number(form.minimum_trading_days),
        hard_risk_per_trade: form.hard_risk_per_trade && String(form.hard_risk_per_trade).trim()
          ? String(form.hard_risk_per_trade).trim()
          : null,
        risk_per_trade_enforcement: form.risk_per_trade_enforcement ?? "confirm",
        hard_risk_enforcement: form.hard_risk_enforcement ?? "block",
        drawdown_basis: form.drawdown_basis ?? "high_water_mark",
        preferred_windows: form.preferred_windows ?? [],
        extra_restrictions: form.extra_restrictions ?? {},
        notes: form.notes ?? null,
      };

      await api<RiskProfile>(`/api/accounts/${accountId}/risk-profile`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      // Re-read the canonical record so the UI confirms persisted server state,
      // rather than merely assuming that a successful request means it is saved.
      const persisted = await api<RiskProfile>(`/api/accounts/${accountId}/risk-profile`);
      setForm(persisted);
      setSaved(true);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Risk limits">
      <p className="muted">
        Monetary limits are absolute amounts in {currency}, not percentages. For example, enter 5 to set a risk limit of 5 {currency}.
        Personal limits should be stricter than applicable firm limits. Leave firm daily drawdown blank when the firm has no daily limit.
      </p>
      {error && <Alert kind="danger">{error}</Alert>}
      {saved && <Alert kind="info">Risk limits saved and reloaded from your account.</Alert>}
      <form onSubmit={onSave} className="grid">
        <Field label={`Risk per trade (${currency})`}>
          <input type="number" min="0.01" step="0.01" required value={String(form.risk_per_trade ?? "")} onChange={(e) => set("risk_per_trade", e.target.value)} />
        </Field>
        <Field label={`Personal daily loss (${currency})`}>
          <input type="number" min="0.01" step="0.01" required value={String(form.personal_daily_loss_limit ?? "")} onChange={(e) => set("personal_daily_loss_limit", e.target.value)} />
        </Field>
        <Field label={`Personal max drawdown (${currency})`}>
          <input type="number" min="0.01" step="0.01" required value={String(form.personal_max_drawdown ?? "")} onChange={(e) => set("personal_max_drawdown", e.target.value)} />
        </Field>
        <Field label={`Firm daily drawdown (${currency}; blank = none)`}>
          <input type="number" min="0" step="0.01" placeholder="None" value={firmDailyLimitDisplayValue(form.firm_daily_drawdown_limit)} onChange={(e) => set("firm_daily_drawdown_limit", e.target.value)} />
        </Field>
        <Field label={`Firm max drawdown (${currency})`}>
          <input type="number" min="0.01" step="0.01" required value={String(form.firm_max_drawdown_limit ?? "")} onChange={(e) => set("firm_max_drawdown_limit", e.target.value)} />
        </Field>
        <Field label="Max trades / day">
          <input type="number" min="1" step="1" required value={String(form.max_trades_per_day ?? "")} onChange={(e) => set("max_trades_per_day", Number(e.target.value))} />
        </Field>
        <Field label="Preferred min R:R">
          <input type="number" min="0.01" step="0.01" required value={String(form.preferred_min_rr ?? "")} onChange={(e) => set("preferred_min_rr", e.target.value)} />
        </Field>
        <Field label="Preferred R:R">
          <input type="number" min="0.01" step="0.01" required value={String(form.preferred_rr ?? "")} onChange={(e) => set("preferred_rr", e.target.value)} />
        </Field>
        <Field label="Minimum trading days">
          <input type="number" min="0" step="1" required value={String(form.minimum_trading_days ?? "")} onChange={(e) => set("minimum_trading_days", Number(e.target.value))} />
        </Field>
        <Field label={`Hard risk cap (${currency}; optional)`}>
          <input type="number" min="0.01" step="0.01" value={String(form.hard_risk_per_trade ?? "")} onChange={(e) => set("hard_risk_per_trade", e.target.value)} />
        </Field>
        <Field label="Over-unit enforcement">
          <select value={form.risk_per_trade_enforcement ?? "confirm"} onChange={(e) => set("risk_per_trade_enforcement", e.target.value)}>
            <option value="warn">Warn</option>
            <option value="confirm">Require confirmation</option>
            <option value="block">Block</option>
          </select>
        </Field>
        <Field label="Hard cap enforcement">
          <select value={form.hard_risk_enforcement ?? "block"} onChange={(e) => set("hard_risk_enforcement", e.target.value)}>
            <option value="warn">Warn</option>
            <option value="confirm">Require confirmation</option>
            <option value="block">Block</option>
          </select>
        </Field>
        <div className="span">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save limits"}</Button>
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
