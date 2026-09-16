export const motion = {
  fast: "120ms",
  normal: "160ms",
  slow: "240ms",
  ease: "ease",
  /** Numeric seconds for the `motion` package. */
  seconds: {
    fast: 0.12,
    normal: 0.16,
    slow: 0.24,
  },
} as const;

/** Prefer meaning over decoration — use Motion only for state/navigation feedback. */
export const motionPolicy = {
  allow: ["disclosure", "drawer", "tab", "focus", "loading"] as const,
  avoid: ["floating", "glow", "decorative-loop"] as const,
};
