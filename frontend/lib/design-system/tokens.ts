/**
 * TraderOS design tokens — TypeScript mirror of CSS variables in globals.css.
 * Prefer CSS vars at runtime; use these for documentation and typed references.
 */

export const semanticColors = {
  background: "var(--bg)",
  surface: "var(--surface)",
  surfaceElevated: "var(--surface-elevated)",
  surface2: "var(--surface-2)",
  border: "var(--border)",
  text: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textMuted: "var(--text-muted)",
  accent: "var(--accent)",
  accentSoft: "var(--accent-soft)",
  accentContrast: "var(--accent-contrast)",
  positive: "var(--pos)",
  negative: "var(--neg)",
  positiveSoft: "var(--pos-soft)",
  negativeSoft: "var(--neg-soft)",
  research: "var(--research)",
  researchSoft: "var(--research-soft)",
  warning: "var(--warning)",
  info: "var(--info)",
} as const;

export const radii = {
  sm: "var(--radius-sm)",
  md: "var(--radius)",
  lg: "var(--radius-lg)",
} as const;

export type DensityMode = "comfortable" | "compact" | "terminal";

export const densityScale: Record<
  DensityMode,
  { padY: string; padX: string; gap: string; fontSize: string }
> = {
  comfortable: { padY: "0.75rem", padX: "1rem", gap: "1rem", fontSize: "0.9375rem" },
  compact: { padY: "0.5rem", padX: "0.75rem", gap: "0.75rem", fontSize: "0.875rem" },
  terminal: { padY: "0.375rem", padX: "0.625rem", gap: "0.5rem", fontSize: "0.8125rem" },
};

/** Canonical token names — aliases (--ink, --line, --green) remain for compat. */
export const CANONICAL_TOKENS = [
  "--bg",
  "--surface",
  "--surface-elevated",
  "--surface-2",
  "--border",
  "--text-primary",
  "--text-secondary",
  "--text-muted",
  "--accent",
  "--pos",
  "--neg",
  "--pos-soft",
  "--neg-soft",
  "--research",
  "--research-soft",
  "--warning",
  "--info",
  "--radius",
  "--radius-sm",
] as const;
