import { cn } from "@/lib/utils";

/** Shared loading placeholder for trader surfaces (pages, panels, strips). */
export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <p className={cn("m-0 text-[13px] text-muted-foreground", className)} role="status" aria-live="polite">
      {label}
    </p>
  );
}

/** Compact inline spinner for buttons and tight chrome. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent",
        className,
      )}
      aria-hidden
    />
  );
}
