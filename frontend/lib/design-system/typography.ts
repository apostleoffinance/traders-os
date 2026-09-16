export const typography = {
  display: { size: "1.75rem", weight: 600, tracking: "-0.025em" },
  pageTitle: { size: "1.5rem", weight: 600, tracking: "-0.025em" },
  sectionTitle: { size: "0.84375rem", weight: 700, tracking: "0.08em", transform: "uppercase" as const },
  metric: { size: "1.1875rem", weight: 600, family: "mono" as const },
  body: { size: "0.9375rem", weight: 400 },
  label: { size: "0.6875rem", weight: 600, tracking: "0.08em", transform: "uppercase" as const },
  caption: { size: "0.75rem", weight: 400 },
  financial: { size: "inherit", weight: 600, family: "mono" as const, variantNumeric: "tabular-nums" as const },
} as const;
