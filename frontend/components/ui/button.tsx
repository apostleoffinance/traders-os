import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] text-sm font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground border border-primary hover:opacity-90",
        primary: "bg-primary text-primary-foreground border border-primary hover:opacity-90",
        ghost: "bg-transparent text-foreground border border-[var(--line-strong)] hover:bg-secondary",
        danger: "bg-transparent text-destructive border border-destructive hover:bg-[var(--danger-bg)]",
        outline: "bg-transparent border border-border text-foreground hover:bg-secondary",
        secondary: "bg-secondary text-secondary-foreground border border-border hover:opacity-90",
        link: "border-0 bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Legacy TraderOS API — maps to variant */
  kind?: "primary" | "ghost" | "danger";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, kind, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const resolvedVariant = variant ?? (kind === "ghost" ? "ghost" : kind === "danger" ? "danger" : kind === "primary" ? "primary" : "default");
    return (
      <Comp className={cn(buttonVariants({ variant: resolvedVariant, size, className }))} ref={ref} type={type} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
