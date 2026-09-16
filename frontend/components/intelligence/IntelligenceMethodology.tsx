"use client";

/** Low-priority methodology — how Intelligence generates findings. */
export function IntelligenceMethodology({ tradeCount }: { tradeCount?: number }) {
  const sampleLine =
    tradeCount != null && tradeCount > 0
      ? `TraderOS currently has ${tradeCount} completed trade${tradeCount === 1 ? "" : "s"} in this view. That is enough to describe what happened${tradeCount < 20 ? ", but not enough to establish a reliable long-term pattern" : ""}.`
      : null;

  return (
    <details className="method">
      <summary>How TraderOS finds patterns</summary>
      <div className="body">
        {sampleLine ? <p>{sampleLine}</p> : null}
        <p>
          TraderOS Intelligence sits above Analytics: it connects your performance, behaviour,
          execution and risk to surface what deserves attention — not a second dashboard.
        </p>
        <ol>
          <li>
            <strong>Facts</strong> come from your closed trades via existing analytics engines
            (performance, edge, behaviour, execution, risk).
          </li>
          <li>
            <strong>Signals</strong> are ranked by severity, trades analyzed, and magnitude — thin
            history cannot outrank well-supported patterns.
          </li>
          <li>
            <strong>Pattern strength</strong> is sample-aware (Early observation → Pattern we&apos;re
            seeing → Repeated → Stronger history). It is not an AI score and not statistical
            significance unless Quant Lab says so.
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
