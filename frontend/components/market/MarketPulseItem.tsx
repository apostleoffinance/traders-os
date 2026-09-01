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
      className="market-pulse__item"
      tabIndex={tabbable ? undefined : -1}
      title={`Open ${quote.display_symbol} in calculator`}
    >
      <span className="market-pulse__symbol">{quote.display_symbol}</span>
      <span className="market-pulse__price">
        {quote.price != null ? formatQuotePrice(quote.price, quote.asset_class) : "—"}
      </span>
      <span
        className={`market-pulse__change market-pulse__change--${changeClass}`}
        aria-label={`Change ${formatChangePercent(quote.change_percent)}`}
      >
        <span className="market-pulse__arrow" aria-hidden>
          {changeArrow(quote.direction)}
        </span>
        <span className="market-pulse__percent">{formatChangePercent(quote.change_percent)}</span>
      </span>
    </Link>
  );
}
