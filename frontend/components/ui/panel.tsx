import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  children,
  right,
  className,
}: {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-4 rounded-[var(--radius)] border border-border bg-card px-4 py-3.5 text-card-foreground", className)}>
      {(title || right) && (
        <header className="mb-3 flex items-baseline justify-between gap-3">
          {title ? (
            <h2 className="m-0 text-[13.5px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{title}</h2>
          ) : (
            <span />
          )}
          {right}
        </header>
      )}
      {children}
    </section>
  );
}
