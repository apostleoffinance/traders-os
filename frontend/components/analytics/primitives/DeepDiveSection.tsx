"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { motion as motionTokens } from "@/lib/design-system/motion";

export function DeepDiveSection({
  title = "Advanced analysis",
  description = "Statistical and diagnostic charts for deeper investigation.",
  defaultOpen = false,
  children,
}: {
  title?: string;
  description?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const duration = Number.parseFloat(motionTokens.normal) / 1000;

  return (
    <section className="deep-dive" data-disclosure="deep_dive">
      <button type="button" className="toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>
          <span className="layer">Deep dive</span>
          <strong>{title}</strong>
          <span className="desc">{description}</span>
        </span>
        <span className="chev" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            className="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration, ease: "easeOut" }}
          >
            <div className="inner">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <style jsx>{`
        .deep-dive {
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          margin: 8px 0 16px;
        }
        .toggle {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border: none;
          background: color-mix(in srgb, var(--surface-2, var(--surface)) 40%, var(--surface));
          cursor: pointer;
          text-align: left;
        }
        .layer {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 2px;
        }
        .toggle strong {
          display: block;
          font-size: 14px;
          margin-bottom: 2px;
        }
        .desc {
          display: block;
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 400;
        }
        .chev {
          font-size: 16px;
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .body {
          overflow: hidden;
        }
        .inner {
          padding: 4px 0 8px;
        }
        .inner :global(.chart-card:last-child) {
          margin-bottom: 0;
        }
      `}</style>
    </section>
  );
}
