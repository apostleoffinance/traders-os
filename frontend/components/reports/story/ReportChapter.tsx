"use client";

import type { ReactNode } from "react";

/** Section wrapper for reports — title + charts only. */
export function ReportChapter({
  id,
  title,
  question: _question,
  takeaway: _takeaway,
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
      <h2 className="title">{title}</h2>
      <div className="body">{children}</div>
      <style jsx>{`
        .chapter {
          break-inside: avoid;
          margin-bottom: 24px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--border);
          scroll-margin-top: 80px;
        }
        .title {
          margin: 0 0 14px;
          font-size: 18px;
          font-weight: 650;
        }
        .body {
          min-width: 0;
        }
        @media print {
          .chapter {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </section>
  );
}
