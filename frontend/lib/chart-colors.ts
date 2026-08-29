import type { chartTheme } from "@/lib/theme";

export type ChartPalette = ReturnType<typeof chartTheme>;

/** Green = profit / positive · Red = loss / negative · Muted = zero / breakeven */
export function colorForPnl(C: ChartPalette, value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return C.muted;
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n) || n === 0) return C.muted;
  return n > 0 ? C.pos : C.neg;
}

/** Green = long · Sky blue = short (direction only — not profit/loss) */
export function colorForDirection(C: ChartPalette, direction: string | null | undefined): string {
  const d = (direction ?? "").toLowerCase();
  if (d === "long") return C.long;
  if (d === "short") return C.short;
  return C.muted;
}

/** Color histogram bin by midpoint sign (for signed ranges like R or P&L). */
export function colorForBinRange(C: ChartPalette, from: number, to: number): string {
  return colorForPnl(C, (from + to) / 2);
}

/** Win / loss / breakeven trade result coloring */
export function colorForResult(C: ChartPalette, result: string | null | undefined): string {
  const r = (result ?? "").toLowerCase();
  if (r === "win") return C.pos;
  if (r === "loss") return C.neg;
  return C.muted;
}
