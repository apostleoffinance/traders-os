"use client";

import type { ReactNode } from "react";

export type DisclosureLayerKind = "decision" | "evidence" | "deep_dive";

const COPY: Record<DisclosureLayerKind, { label: string; hint: string }> = {
  decision: {
    label: "Decision",
    hint: "WHAT / SO WHAT — answer first",
  },
  evidence: {
    label: "Evidence",
    hint: "Essential charts that prove the answer",
  },
  deep_dive: {
    label: "Deep dive",
    hint: "Optional research — open when you need more",
  },
};

/**
 * Progressive disclosure chrome for Analytics tabs.
 * Decision → Evidence → Deep Dive.
 */
export function DisclosureLayer({
  kind,
  children,
  className,
}: {
  kind: DisclosureLayerKind;
  children: ReactNode;
  className?: string;
}) {
  const copy = COPY[kind];
  return (
    <section className={className} data-disclosure={kind} aria-label={copy.label}>
      <div className="layer-meta">
        <span className="layer-label">{copy.label}</span>
        <span className="layer-hint">{copy.hint}</span>
      </div>
      <div className="layer-body">{children}</div>
      <style jsx>{`
        section {
          margin: 0 0 12px;
        }
        .layer-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 8px;
        }
        .layer-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--accent);
        }
        .layer-hint {
          font-size: 12px;
          color: var(--text-muted);
        }
        .layer-body {
          min-width: 0;
        }
      `}</style>
    </section>
  );
}
