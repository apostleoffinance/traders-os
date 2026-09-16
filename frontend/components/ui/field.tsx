import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1 text-[15px]", className)}>
      <Label asChild>
        <span>{label}</span>
      </Label>
      {children}
    </label>
  );
}
