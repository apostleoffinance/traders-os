"use client";

import Link from "next/link";

export function IntelligenceEmptyState({ tradeCount = 0 }: { tradeCount?: number }) {
  return (
    <section className="empty" aria-labelledby="intel-empty-title">
      <h2 id="intel-empty-title">Start building your trading intelligence</h2>
      <p>TraderOS needs completed trades to identify:</p>
      <ul>
        <li>performance patterns</li>
        <li>trading edges</li>
        <li>execution inefficiencies</li>
        <li>behaviour patterns</li>
        <li>risk deviations</li>
      </ul>
      <p className="count">
        <strong>{tradeCount}</strong> completed trades
      </p>
      <div className="actions">
        <Link href="/trades/new" className="btn primary">
          Log a Trade
        </Link>
        <Link href="/accounts" className="btn">
          Connect MT5
        </Link>
      </div>
      <style jsx>{`
        .empty {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          padding: 22px 20px;
          display: grid;
          gap: 10px;
          max-width: 560px;
        }
        h2 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 650;
          color: var(--text-primary);
        }
        p {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
          color: var(--text-secondary);
        }
        ul {
          margin: 0;
          padding-left: 1.1rem;
          color: var(--text-muted);
          font-size: 13px;
          line-height: 1.55;
        }
        .count {
          font-size: 13px;
          color: var(--text-muted);
        }
        .count strong {
          color: var(--text-primary);
          font-variant-numeric: tabular-nums;
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 4px;
        }
        .empty :global(.btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 650;
          text-decoration: none;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-primary);
        }
        .empty :global(.btn.primary) {
          background: var(--accent);
          border-color: transparent;
          color: var(--accent-contrast);
        }
        .empty :global(.btn:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
      `}</style>
    </section>
  );
}

export function IntelligenceNoFindingState({ tradeCount }: { tradeCount: number }) {
  return (
    <section className="none" aria-labelledby="intel-none-title">
      <p className="eyebrow">Primary intelligence</p>
      <h2 id="intel-none-title">No standout pattern in this window</h2>
      <p>
        TraderOS reviewed {tradeCount} closed trade{tradeCount === 1 ? "" : "s"} and did not surface a
        high-confidence finding for the current filters. Try a longer period or clear narrow filters.
      </p>
      <style jsx>{`
        .none {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          padding: 18px 20px;
          display: grid;
          gap: 8px;
        }
        .eyebrow {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        h2 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 650;
        }
        p:last-child {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-secondary);
        }
      `}</style>
    </section>
  );
}

export function IntelligenceErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="err" role="alert">
      <h2>Intelligence couldn&apos;t be generated right now</h2>
      <p>Check your connection and try again. Your trades and analytics were not modified.</p>
      <button type="button" className="retry" onClick={onRetry}>
        Retry
      </button>
      <style jsx>{`
        .err {
          border: 1px solid color-mix(in srgb, var(--neg) 35%, var(--border));
          border-radius: 12px;
          background: color-mix(in srgb, var(--neg) 8%, var(--surface));
          padding: 18px 20px;
          display: grid;
          gap: 8px;
          max-width: 520px;
        }
        h2 {
          margin: 0;
          font-size: 1.05rem;
        }
        p {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .retry {
          justify-self: start;
          margin-top: 4px;
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-primary);
          font-size: 13px;
          font-weight: 650;
          cursor: pointer;
        }
        .retry:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
      `}</style>
    </section>
  );
}
