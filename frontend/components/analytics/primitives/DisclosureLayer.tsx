"use client";

import { Children, type ReactNode } from "react";

export type DisclosureLayerKind = "decision" | "evidence" | "deep_dive";

function hasRenderableChildren(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (child == null) return false;
    if (typeof child === "boolean") return false;
    return true;
  });
}

/** Layout wrapper — skips empty sections so null children don't leave gaps. */
export function DisclosureLayer({
  kind,
  children,
  className,
}: {
  kind: DisclosureLayerKind;
  children: ReactNode;
  className?: string;
}) {
  if (!hasRenderableChildren(children)) return null;
  return (
    <section className={className} data-disclosure={kind}>
      {children}
      <style jsx>{`
        section {
          margin: 0 0 12px;
          min-width: 0;
        }
      `}</style>
    </section>
  );
}
