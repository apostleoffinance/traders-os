"use client";

import Link from "next/link";
import type { MarketQuote } from "@/lib/market";
import { changeArrow, formatChangePercent, formatQuotePrice } from "@/lib/market";

export function MarketPulseItem({ quote }: { quote: MarketQuote }) {
  const isUp = quote.direction === "up";
  const isDown = quote.direction === "down";
  const changeClass = isUp ? "up" : isDown ? "down" : "flat";
  const href = `/calculator?instrument=${encodeURIComponent(quote.symbol)}`;

  return (
    <Link href={href} className={`item ${changeClass}${quote.is_stale ? " stale" : ""}`} title={`Open ${quote.display_symbol} in calculator`}>
      <span className="sym">{quote.display_symbol}</span>
      <span className="price num">{quote.price != null ? formatQuotePrice(quote.price, quote.asset_class) : "—"}</span>
      <span className={`chg ${changeClass}`} aria-label={`Change ${formatChangePercent(quote.change_percent)}`}>
        <span className="arrow" aria-hidden>
          {changeArrow(quote.direction)}
        </span>
        {formatChangePercent(quote.change_percent)}
      </span>
      {quote.is_stale && <span className="delayed">Delayed</span>}
      <style jsx>{`
        .item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 0 18px;
          text-decoration: none;
          color: inherit;
          white-space: nowrap;
          border-right: 1px solid var(--border);
          height: 100%;
          font-size: 12px;
        }
        .item:hover {
          background: color-mix(in srgb, var(--accent) 6%, transparent);
        }
        .sym {
          font-weight: 600;
          color: var(--text-primary);
          min-width: 4.5rem;
        }
        .price {
          font-weight: 600;
          color: var(--text-primary);
          min-width: 4.5rem;
        }
        .chg {
          font-size: 11px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .chg.up {
          color: var(--success);
        }
        .chg.down {
          color: var(--danger);
        }
        .chg.flat {
          color: var(--text-muted);
        }
        .delayed {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          opacity: 0.85;
        }
        .stale .price {
          opacity: 0.85;
        }
      `}</style>
    </Link>
  );
}
