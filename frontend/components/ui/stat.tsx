import * as React from "react";
import { cn } from "@/lib/utils";

export type StatSize = "metric" | "label" | "compact";

function resolveStatSize(value: React.ReactNode, size?: StatSize): StatSize {
  if (size) return size;
  if (typeof value === "string" && value.length > 22) return "label";
  return "metric";
}

export function Stat({
  label,
  value,
  tone,
  hint,
  size,
  className,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "pos" | "neg" | "warn" | "ok" | "";
  hint?: string;
  size?: StatSize;
  className?: string;
}) {
  const resolved = resolveStatSize(value, size);
  return (
    <div className={cn("min-w-0 max-w-full", className)}>
      <div className="mb-1 text-[12px] leading-[1.35] font-semibold uppercase tracking-[0.045em] text-[var(--text-secondary)] [overflow-wrap:anywhere]">
        {label}
      </div>
      <div
        className={cn(
          "num max-w-full font-semibold leading-[1.25] tracking-[-0.02em] [overflow-wrap:anywhere]",
          resolved === "metric" && "text-[18px]",
          resolved === "label" && "line-clamp-2 text-[14px]",
          resolved === "compact" && "text-[16px]",
          tone === "pos" && "text-positive",
          tone === "neg" && "text-negative",
          tone === "warn" && "text-warning",
          tone === "ok" && "text-positive",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs leading-snug text-[var(--text-secondary)] [overflow-wrap:anywhere]">{hint}</div> : null}
    </div>
  );
}
