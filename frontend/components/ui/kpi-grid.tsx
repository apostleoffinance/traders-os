import { cn } from "@/lib/utils";

export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("kpi-grid", className)}>{children}</div>;
}
