"use client";

import Link from "next/link";

export function IntelligenceEmptyState({ tradeCount = 0 }: { tradeCount?: number }) {
  return (
    <section className="empty" aria-labelledby="intel-empty-title">
      <h2 id="intel-empty-title">Nothing to analyze yet</h2>
      <p>
        Once you close a few trades, TraderOS will start surfacing patterns in your performance,
        behaviour and risk.
      </p>
      {tradeCount > 0 ? (
        <p className="count">
          <strong>{tradeCount}</strong> completed trade{tradeCount === 1 ? "" : "s"} so far
        </p>
      ) : null}
      <div className="actions">
        <Link href="/trades/new" className="btn primary">
          Log a trade
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
          max-width: 480px;
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
      <h2 id="intel-none-title">No clear pattern yet</h2>
      <p>
        {tradeCount} trade{tradeCount === 1 ? "" : "s"} analyzed — nothing stands out enough to surface
        as a primary finding right now.
      </p>
      <p className="hint">Keep journaling. Patterns become clearer as your history grows.</p>
      <style jsx>{`
        .none {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          padding: 18px 16px;
          display: grid;
          gap: 8px;
          max-width: 520px;
        }
        h2 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 650;
        }
        p {
          margin: 0;
          font-size: 14px;
          line-height: 1.45;
          color: var(--text-secondary);
        }
        .hint {
          font-size: 13px;
          color: var(--text-muted);
        }
      `}</style>
    </section>
  );
}

export function IntelligenceErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="err" role="alert">
      <h2>Couldn’t load intelligence</h2>
      <p>Check your connection and try again.</p>
      <button type="button" className="retry" onClick={onRetry}>
        Retry
      </button>
      <style jsx>{`
        .err {
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
          padding: 18px 16px;
          display: grid;
          gap: 8px;
          max-width: 420px;
        }
        h2 {
          margin: 0;
          font-size: 1.05rem;
        }
        p {
          margin: 0;
          font-size: 14px;
          color: var(--text-secondary);
        }
        .retry {
          width: fit-content;
          margin-top: 4px;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-primary);
          border-radius: 8px;
          padding: 8px 14px;
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
