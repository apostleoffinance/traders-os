import { money, num, signed } from "@/lib/format";

/** Shared number / money formatting for visualization tooltips and axes. */

export function formatAxisMoney(value: number, currency: string): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${money(value / 1_000_000, currency)}M`.replace(currency, "").trim() || `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return money(Math.round(value), currency);
  return money(value, currency);
}

export function formatAxisNumber(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return num(value, digits);
}

export function formatR(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return signed(n, "R");
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${num(value, digits)}%`;
}

export function formatSampleSize(n: number): string {
  return `${n} trade${n === 1 ? "" : "s"}`;
}

export function formatDateShort(iso: string): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

/** Compact delta label for KPI cards. */
export function formatDelta(change: string | number | null | undefined): string | null {
  if (change === null || change === undefined || change === "") return null;
  return String(change);
}
