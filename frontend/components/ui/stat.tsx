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
    <div className={cn("min-w-0", className)}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{label}</div>
      <div
        className={cn(
          "num font-semibold leading-snug break-words",
          resolved === "metric" && "text-[19px]",
          resolved === "label" && "line-clamp-2 text-[15px]",
          resolved === "compact" && "text-base",
          tone === "pos" && "text-positive",
          tone === "neg" && "text-negative",
          tone === "warn" && "text-warning",
          tone === "ok" && "text-positive",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs leading-snug text-[var(--text-secondary)]">{hint}</div> : null}
    </div>
  );
}
