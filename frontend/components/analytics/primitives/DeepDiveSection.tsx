"use client";

import { useState, type ReactNode } from "react";

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

  return (
    <section className="deep-dive">
      <button type="button" className="toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>
          <strong>{title}</strong>
          <span className="desc">{description}</span>
        </span>
        <span className="chev">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="body">{children}</div>}
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
          font-size: 18px;
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .body {
          padding: 4px 0 8px;
        }
        .body :global(.chart-card:last-child) {
          margin-bottom: 0;
        }
      `}</style>
    </section>
  );
}
