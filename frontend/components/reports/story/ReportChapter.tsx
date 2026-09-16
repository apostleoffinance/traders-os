"use client";

import type { ReactNode } from "react";

/**
 * Story chapter chrome for print/PDF reports.
 * WHAT (question) → SO WHAT (takeaway) → Evidence below.
 * No opacity animation — print/PDF must always render fully.
 */
export function ReportChapter({
  id,
  title,
  question,
  takeaway,
  children,
}: {
  id: string;
  title: string;
  question: string;
  takeaway?: string | null;
  children: ReactNode;
}) {
  return (
    <section id={id} className="chapter">
      <header className="head">
        <h2 className="title">{title}</h2>
        <p className="question">
          <span className="label">What?</span>
          {question}
        </p>
        {takeaway ? (
          <p className="takeaway">
            <span className="label">So what?</span>
            {takeaway}
          </p>
        ) : null}
      </header>
      <div className="body">
        <p className="evidence-label">Evidence</p>
        {children}
      </div>
      <style jsx>{`
        .chapter {
          break-inside: avoid;
          margin-bottom: 28px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
          scroll-margin-top: 80px;
        }
        .head {
          margin-bottom: 16px;
        }
        .title {
          margin: 0 0 10px;
          font-size: 18px;
          font-weight: 650;
        }
        .label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 4px;
        }
        .question {
          margin: 0 0 10px;
          font-size: 14px;
          color: var(--text-muted);
        }
        .takeaway {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary, var(--text));
          padding: 10px 12px;
          border-left: 3px solid var(--accent);
          background: color-mix(in srgb, var(--surface-2, var(--surface)) 55%, transparent);
          border-radius: 0 8px 8px 0;
        }
        .evidence-label {
          margin: 0 0 10px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .body {
          min-width: 0;
        }
        @media print {
          .chapter {
            break-before: auto;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </section>
  );
}
