import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-[var(--radius-sm)] border px-3.5 py-3 text-[15px] font-semibold mb-2.5", {
  variants: {
    variant: {
      default: "bg-card text-foreground border-border",
      info: "bg-[var(--info-bg)] text-foreground border-transparent",
      warn: "bg-[var(--amber-bg)] text-foreground border-transparent",
      warning: "bg-[var(--amber-bg)] text-foreground border-transparent",
      danger: "bg-[var(--red-bg)] text-foreground border-transparent",
      destructive: "bg-[var(--red-bg)] text-foreground border-transparent",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  /** Legacy TraderOS API */
  kind?: "warn" | "danger" | "info";
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, variant, kind, ...props }, ref) => {
  const resolved = variant ?? (kind === "warn" ? "warn" : kind === "danger" ? "danger" : kind === "info" ? "info" : "default");
  return <div ref={ref} role="alert" className={cn(alertVariants({ variant: resolved }), className)} {...props} />;
});
Alert.displayName = "Alert";

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-1 font-semibold leading-none tracking-tight", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-sm font-normal opacity-90 [&_p]:leading-relaxed", className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
