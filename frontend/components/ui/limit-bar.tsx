import { cn } from "@/lib/utils";

function formatMoneyish(value: string | number): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function LimitBar({
  label,
  limit,
  remaining,
  used,
  className,
}: {
  label: string;
  limit: string;
  remaining?: string;
  used?: string;
  className?: string;
}) {
  const cap = Number(limit);
  const left = remaining != null ? Number(remaining) : NaN;
  const spent = used != null ? Number(used) : cap - left;
  const usedPct = cap > 0 && !Number.isNaN(spent) ? Math.max(0, Math.min(100, (spent / cap) * 100)) : 0;
  let t: "ok" | "warn" | "neg" | "" = "";
  if (cap && !Number.isNaN(spent)) {
    if (spent >= cap) t = "neg";
    else if (usedPct >= 70) t = "warn";
    else t = "ok";
  }
  const remainingLabel = remaining != null && !Number.isNaN(left) ? remaining : String(Math.max(0, cap - spent));

  return (
    <div className={cn("border-b border-border py-2.5 last:border-b-0 last:pb-0", className)}>
      <div className="mb-1.5 flex justify-between gap-3 text-[15px] font-semibold">
        <span>{label}</span>
        <span
          className={cn(
            "num",
            t === "ok" && "text-positive",
            t === "warn" && "text-warning",
            t === "neg" && "text-negative",
          )}
        >
          {used != null || remaining != null
            ? `${formatMoneyish(spent)} / ${formatMoneyish(cap)} used`
            : formatMoneyish(cap)}
        </span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-sm bg-secondary" aria-hidden>
        <div
          className={cn(
            "h-full bg-positive",
            t === "warn" && "bg-warning",
            t === "neg" && "bg-negative",
          )}
          style={{ width: `${usedPct}%` }}
        />
      </div>
      {remaining != null && (
        <div className="muted mt-1 text-[13px]">
          {formatMoneyish(remainingLabel)} remaining of {formatMoneyish(cap)} limit
        </div>
      )}
    </div>
  );
}
