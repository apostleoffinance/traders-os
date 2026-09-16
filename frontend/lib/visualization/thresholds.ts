/** Shared thresholds for semantic coloring and insight tone — not trading advice. */

export const SAMPLE = {
  /** Below this, treat group comparisons as early / fragile. */
  minGroup: 3,
  /** Prefer this before strong confidence language. */
  comfortable: 20,
  /** Quant research default. */
  research: 30,
} as const;

export const EXPECTANCY = {
  /** Soft positive band (R). */
  positive: 0.05,
  /** Soft negative band (R). */
  negative: -0.05,
} as const;

export const PROFIT_FACTOR = {
  fragile: 1.2,
  solid: 1.5,
} as const;

export const DRAWDOWN = {
  /** Soft warning when current DD exceeds this fraction of max DD. */
  elevatedVsMax: 0.7,
} as const;

export function expectancyTone(value: number | null | undefined): "pos" | "neg" | "neutral" {
  if (value == null || !Number.isFinite(value)) return "neutral";
  if (value >= EXPECTANCY.positive) return "pos";
  if (value <= EXPECTANCY.negative) return "neg";
  return "neutral";
}
