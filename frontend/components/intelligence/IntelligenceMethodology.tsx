"use client";

/** Low-priority methodology — how Intelligence generates findings. */
export function IntelligenceMethodology() {
  return (
    <details className="method">
      <summary>How TraderOS finds patterns</summary>
      <div className="body">
        <p>
          TraderOS Intelligence is a decision layer on top of deterministic analytics — not a second
          chart wall and not a signal feed.
        </p>
        <ol>
          <li>
            <strong>Facts</strong> come from your closed trades via existing analytics engines
            (performance, edge, behaviour, execution, risk).
          </li>
          <li>
            <strong>Findings</strong> are ranked by severity, sample size, and magnitude — thin samples
            cannot outrank well-supported patterns.
          </li>
          <li>
            <strong>Confidence</strong> is sample-aware (Early → Emerging → Supported → Stronger
            history). It is not an AI score and not statistical significance unless Quant Lab says so.
          </li>
          <li>
            <strong>Investigate</strong> opens evidence and the related lab. Optional AI explains the
            locked facts — it cannot invent metrics or trade signals.
          </li>
        </ol>
      </div>
      <style jsx>{`
        .method {
          margin-top: 8px;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
        }
        summary {
          cursor: pointer;
          font-size: 12px;
          font-weight: 650;
          color: var(--text-secondary);
          list-style: none;
        }
        summary::-webkit-details-marker {
          display: none;
        }
        summary::before {
          content: "▸ ";
          color: var(--text-muted);
        }
        .method[open] summary::before {
          content: "▾ ";
        }
        summary:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
          border-radius: 2px;
        }
        .body {
          margin-top: 10px;
          display: grid;
          gap: 8px;
        }
        p {
          margin: 0;
          font-size: 12px;
          line-height: 1.5;
          color: var(--text-muted);
        }
        ol {
          margin: 0;
          padding-left: 1.15rem;
          font-size: 12px;
          line-height: 1.5;
          color: var(--text-secondary);
          display: grid;
          gap: 6px;
        }
        strong {
          color: var(--text-primary);
          font-weight: 650;
        }
      `}</style>
    </details>
  );
}
