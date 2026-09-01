"use client";

import Link from "next/link";
import type { MarketQuote } from "@/lib/market";
import { changeArrow, formatChangePercent, formatQuotePrice } from "@/lib/market";

export function MarketPulseItem({ quote, tabbable = true }: { quote: MarketQuote; tabbable?: boolean }) {
  const isUp = quote.direction === "up";
  const isDown = quote.direction === "down";
  const changeClass = isUp ? "up" : isDown ? "down" : "flat";
  const href = `/calculator?instrument=${encodeURIComponent(quote.symbol)}`;

  return (
    <Link
      href={href}
      className={`item ${changeClass}`}
      tabIndex={tabbable ? undefined : -1}
      title={`Open ${quote.display_symbol} in calculator`}
    >
      <span className="sym">{quote.display_symbol}</span>
      <span className="price">{quote.price != null ? formatQuotePrice(quote.price, quote.asset_class) : "—"}</span>
      <span className={`chg ${changeClass}`} aria-label={`Change ${formatChangePercent(quote.change_percent)}`}>
        <span className="arrow" aria-hidden>
          {changeArrow(quote.direction)}
        </span>
        {formatChangePercent(quote.change_percent)}
      </span>
      <style jsx>{`
        .item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 16px;
          text-decoration: none;
          color: inherit;
          white-space: nowrap;
          border-right: 1px solid var(--border);
          height: 100%;
          font-size: 11px;
        }
        .item:hover {
          background: color-mix(in srgb, var(--accent) 4%, transparent);
        }
        .sym {
          font-weight: 700;
          color: var(--text-primary);
          min-width: 4rem;
        }
        .price {
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--text-primary);
          min-width: 4rem;
        }
        .chg {
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
      `}</style>
    </Link>
  );
}
