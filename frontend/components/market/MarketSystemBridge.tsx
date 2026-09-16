"use client";

import Link from "next/link";

type Props = {
  tradeId?: string;
  symbol?: string;
};

/**
 * Bridges Market Lab into the rest of TraderOS without a dedicated /market product route.
 */
export function MarketSystemBridge({ tradeId, symbol }: Props) {
  const tradeHref = tradeId ? `/trades/${tradeId}` : "/trades";
  const items = [
    {
      label: "Trade",
      href: tradeHref,
      what: "Journal entry & review",
      soWhat: tradeId ? "Open the overlay trade" : "Pick a trade to overlay",
    },
    {
      label: "Execution",
      href: `/analytics?tab=execution`,
      what: "Sizing, hold, exit capture",
      soWhat: "Did I execute this setup well?",
    },
    {
      label: "Performance",
      href: `/analytics?tab=performance`,
      what: "Equity & outcomes",
      soWhat: "How does this trade sit in the curve?",
    },
    {
      label: "Risk",
      href: `/analytics?tab=risk`,
      what: "Budget & drawdown",
      soWhat: "Was size inside policy?",
    },
  ];

  return (
    <section className="bridge" aria-label="Continue in TraderOS">
      <h2 className="title">Continue the investigation</h2>
      <p className="lead">
        Market context{symbol ? ` for ${symbol}` : ""} is step one. Use Analytics for decisions — candles alone are
        not the edge.
      </p>
      <div className="grid">
        {items.map((item) => (
          <Link key={item.label} href={item.href} className="card">
            <span className="label">{item.label}</span>
            <strong>{item.what}</strong>
            <span className="so">{item.soWhat}</span>
            <span className="cta">Open →</span>
          </Link>
        ))}
      </div>
      <style jsx>{`
        .bridge {
          margin-top: 8px;
        }
        .title {
          margin: 0 0 4px;
          font-size: 15px;
        }
        .lead {
          margin: 0 0 12px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }
        .card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          text-decoration: none;
          color: inherit;
          min-height: 110px;
        }
        .card:hover {
          border-color: var(--accent);
        }
        .label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--accent);
        }
        strong {
          font-size: 13px;
        }
        .so {
          font-size: 12px;
          color: var(--text-muted);
          flex: 1;
        }
        .cta {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          margin-top: 4px;
        }
      `}</style>
    </section>
  );
}
