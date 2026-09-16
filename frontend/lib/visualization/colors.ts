import { chartTheme } from "@/lib/theme";
import {
  colorForBinRange,
  colorForDirection,
  colorForPnl,
  colorForResult,
  type ChartPalette,
} from "@/lib/chart-colors";

export type { ChartPalette };

/** Live chart palette from CSS tokens (theme-aware). */
export function vizPalette(): ChartPalette {
  return chartTheme();
}

export { colorForPnl, colorForDirection, colorForBinRange, colorForResult };

/** Semantic fill for positive / negative / neutral areas (uPlot / canvas). */
export function areaColor(tone: "pos" | "neg" | "neutral", alpha = 0.2): string {
  const C = vizPalette();
  const hex = tone === "pos" ? C.pos : tone === "neg" ? C.neg : C.muted;
  return withAlpha(hex, alpha);
}

export function withAlpha(hex: string, alpha: number): string {
  const raw = hex.trim();
  if (raw.startsWith("rgba") || raw.startsWith("rgb")) return raw;
  const m = /^#([0-9a-f]{6})$/i.exec(raw);
  if (!m) return raw;
  const a = Math.max(0, Math.min(1, alpha));
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
