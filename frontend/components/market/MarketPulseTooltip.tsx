"use client";

import type { MarketQuote } from "@/lib/market";
import { changeArrow, formatChangePercent, formatQuotePrice } from "@/lib/market";

function ago(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export function MarketPulseTooltip({ quote }: { quote: MarketQuote }) {
  const status = quote.is_stale ? "Delayed" : quote.status === "unavailable" ? "Unavailable" : "Live";

  return (
    <div className="tip" role="tooltip">
      <strong>{quote.display_symbol}</strong>
      <div className="row">
        <span className="label">Current</span>
        <span className="num">{quote.price != null ? formatQuotePrice(quote.price, quote.asset_class) : "—"}</span>
      </div>
      <div className="row">
        <span className="label">Change</span>
        <span className={quote.direction === "up" ? "up" : quote.direction === "down" ? "down" : ""}>
          {changeArrow(quote.direction)} {formatChangePercent(quote.change_percent)}
        </span>
      </div>
      <div className="row">
        <span className="label">Updated</span>
        <span>{ago(quote.age_seconds)}</span>
      </div>
      <div className="row">
        <span className="label">Status</span>
        <span>{status}</span>
      </div>
      <style jsx>{`
        .tip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          min-width: 160px;
          padding: 10px 12px;
          background: var(--surface-elevated);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: var(--shadow);
          font-size: 12px;
          pointer-events: none;
        }
        strong {
          display: block;
          margin-bottom: 8px;
          font-size: 13px;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 4px;
          color: var(--text-secondary);
        }
        .label {
          color: var(--text-muted);
        }
        .up {
          color: var(--success);
        }
        .down {
          color: var(--danger);
        }
      `}</style>
    </div>
  );
}
