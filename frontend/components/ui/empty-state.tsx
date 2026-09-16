import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-[var(--radius)] border border-border bg-card px-4 py-[18px]",
        className,
      )}
    >
      <strong className="text-[17px] font-bold">{title}</strong>
      {children}
      {action}
    </div>
  );
}
