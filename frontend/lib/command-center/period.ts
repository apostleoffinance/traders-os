import type { PeriodPreset } from "@/lib/filters";

/** Start of global Home/Analytics period window (ms), or null for ALL. */
export function periodStartMs(period: PeriodPreset, now = Date.now()): number | null {
  if (period === "all") return null;
  if (period === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (period === "ytd") {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), 0, 1);
  }
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return now - days * 24 * 60 * 60 * 1000;
}

export function isTimestampInPeriod(iso: string | null | undefined, period: PeriodPreset, now = Date.now()): boolean {
  if (!iso) return false;
  const start = periodStartMs(period, now);
  if (start == null) return true;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= start;
}

export function periodLabelShort(period: PeriodPreset): string {
  switch (period) {
    case "today":
      return "Today";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "90d":
      return "Last 90 days";
    case "ytd":
      return "Year to date";
    case "all":
      return "All time";
    default:
      return period;
  }
}
