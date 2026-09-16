import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius-sm)] border px-2 py-0.5 font-mono text-xs font-semibold tracking-wider uppercase transition-colors",
  {
    variants: {
      variant: {
        default: "border-border bg-transparent text-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success: "border-transparent bg-[var(--green-bg)] text-positive",
        warning: "border-transparent bg-[var(--amber-bg)] text-warning",
        danger: "border-transparent bg-[var(--red-bg)] text-negative",
        accent: "border-transparent bg-[color-mix(in_srgb,var(--accent)_18%,var(--surface))] text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Legacy status string API */
  status?: string;
}

function resolveStatusVariant(status?: string): VariantProps<typeof badgeVariants>["variant"] {
  if (!status) return "default";
  const s = status.toLowerCase();
  if (["green", "ok", "win", "success"].includes(s)) return "success";
  if (["yellow", "warn", "warning"].includes(s)) return "warning";
  if (["red", "loss", "danger"].includes(s)) return "danger";
  if (s === "open") return "accent";
  return "secondary";
}

function Badge({ className, variant, status, children, ...props }: BadgeProps) {
  const resolved = variant ?? resolveStatusVariant(status);
  return (
    <span className={cn(badgeVariants({ variant: resolved }), className)} {...props}>
      {children ?? (status ? status.toUpperCase() : null)}
    </span>
  );
}

export { Badge, badgeVariants };
