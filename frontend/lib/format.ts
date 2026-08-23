export function money(value: string | number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function num(value: string | number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "-";
  return n.toFixed(digits);
}

export function signed(value: string | number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "-";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}${suffix}`;
}

export function cls(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function tone(value: string | number | null | undefined): "pos" | "neg" | "" {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (n > 0) return "pos";
  if (n < 0) return "neg";
  return "";
}

export function sessionLabel(session: string): string {
  const map: Record<string, string> = {
    asia: "Asia",
    london: "London",
    new_york: "New York",
    london_ny_overlap: "London/NY",
    outside: "Outside",
  };
  return map[session] ?? session;
}

export function resultLabel(result: string): string {
  return result.replace("_", " ");
}

export function formatWhen(iso: string, timeZone = "Africa/Lagos"): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export function formatDate(iso: string, timeZone = "Africa/Lagos"): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone = "Africa/Lagos"): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function holdingLabel(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "-";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}
