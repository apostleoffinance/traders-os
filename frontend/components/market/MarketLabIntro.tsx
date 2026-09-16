"use client";

import Link from "next/link";

/**
 * Market Lab intro — Phase 7 coherent system story without promoting a /market route yet.
 */
export function MarketLabIntro() {
  return (
    <header className="intro">
      <div>
        <p className="kicker">Labs · Market context (POC)</p>
        <p className="hierarchy" aria-label="System path">
          <span>Market</span>
          <span className="sep">→</span>
          <span>Trade</span>
          <span className="sep">→</span>
          <span>Execution</span>
          <span className="sep">→</span>
          <span>Performance</span>
          <span className="sep">→</span>
          <span>Risk</span>
        </p>
        <h1 className="title">Market Lab</h1>
        <p className="lead">
          Candles and trade overlays for context around a journaled trade. Vela stays isolated here —
          everyday Analytics charts are unchanged.
        </p>
        <p className="now">
          <strong>Now what?</strong> Overlay a trade, then jump into Analytics to judge execution,
          performance, and risk — not to chase the next candle.
        </p>
      </div>
      <Link href="/trades" className="back">
        ← Trade journal
      </Link>
      <style jsx>{`
        .intro {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 4px;
        }
        .kicker {
          margin: 0 0 4px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .hierarchy {
          margin: 0 0 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--accent);
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          align-items: center;
        }
        .sep {
          color: var(--text-muted);
          font-weight: 500;
        }
        .title {
          margin: 0 0 6px;
          font-size: 1.5rem;
          font-weight: 650;
          letter-spacing: -0.02em;
        }
        .lead {
          margin: 0 0 8px;
          font-size: 14px;
          color: var(--text-muted);
          max-width: 62ch;
          line-height: 1.45;
        }
        .now {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
          max-width: 62ch;
        }
        .now strong {
          color: var(--accent);
          font-size: 10px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-right: 6px;
        }
        .back {
          font-size: 13px;
          font-weight: 600;
          color: var(--accent);
          text-decoration: none;
          white-space: nowrap;
        }
      `}</style>
    </header>
  );
}
