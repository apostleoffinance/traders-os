export type Breakpoint = "mobile" | "tablet" | "desktop";

export function breakpointFromWidth(width: number): Breakpoint {
  if (width < 640) return "mobile";
  if (width < 960) return "tablet";
  return "desktop";
}

/** Default chart heights by surface density. */
export function chartHeight(kind: "hero" | "standard" | "compact" | "spark", bp: Breakpoint = "desktop"): number {
  if (kind === "spark") return 28;
  if (kind === "compact") return bp === "mobile" ? 200 : bp === "tablet" ? 220 : 232;
  if (kind === "hero") return bp === "mobile" ? 240 : bp === "tablet" ? 280 : 320;
  return bp === "mobile" ? 200 : 260;
}

/** Whether to hide secondary axis labels on small screens. */
export function simplifyAxes(bp: Breakpoint): boolean {
  return bp !== "desktop";
}

/** Max ranked rows before truncation on Overview snapshots. */
export function overviewRankLimit(bp: Breakpoint): number {
  return bp === "mobile" ? 3 : 3;
}
