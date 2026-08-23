export type ThemePreference = "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "traderos-theme";
export const THEME_EVENT = "traderos-theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  if (stored === "system") return systemPrefersDark() ? "dark" : "light";
  return "dark";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference;
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference);
  if (typeof document === "undefined") return resolved;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function persistTheme(preference: ThemePreference): ResolvedTheme {
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  const resolved = applyTheme(preference);
  window.dispatchEvent(new Event(THEME_EVENT));
  return resolved;
}

type ChartColors = {
  pos: string;
  neg: string;
  ink: string;
  muted: string;
  line: string;
  blue: string;
  amber: string;
  bg: string;
};

const DARK_CHART: ChartColors = {
  pos: "#18B981",
  neg: "#E56B6F",
  ink: "#F1F5F3",
  muted: "#66736C",
  line: "#25312B",
  blue: "#6EA8FE",
  amber: "#D6A84F",
  bg: "#111714",
};

export function chartTheme(): ChartColors {
  if (typeof document === "undefined") return DARK_CHART;
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    pos: v("--success", DARK_CHART.pos),
    neg: v("--danger", DARK_CHART.neg),
    ink: v("--text-primary", DARK_CHART.ink),
    muted: v("--text-muted", DARK_CHART.muted),
    line: v("--border", DARK_CHART.line),
    blue: v("--info", DARK_CHART.blue),
    amber: v("--warning", DARK_CHART.amber),
    bg: v("--surface", DARK_CHART.bg),
  };
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function firstName(displayName: string | null | undefined): string {
  const part = displayName?.trim().split(/\s+/)[0];
  return part || "Trader";
}
