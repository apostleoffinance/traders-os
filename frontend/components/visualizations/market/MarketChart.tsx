"use client";

import { VelaChart, type DataMode, type VelaChartProps } from "@/components/charts/vela/VelaChart";
import { LoadingState } from "@/components/trader/LoadingState";
import { EmptyState } from "@/components/trader/EmptyState";
import { resolveVizCopy } from "@/lib/visualization";
import { useState } from "react";

export type MarketChartProps = Omit<VelaChartProps, "onMeta"> & {
  onMeta?: VelaChartProps["onMeta"];
  /** Show TraderOS question chrome above the chart. */
  showChrome?: boolean;
};

/**
 * Owned market OHLCV surface — Vela stays behind the adapter.
 * Product pages should import MarketChart, not @luxalgo/vela.
 */
export function MarketChart({
  showChrome = true,
  height = 560,
  symbol,
  onMeta,
  ...rest
}: MarketChartProps) {
  const copy = resolveVizCopy("market_ohlcv");
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!symbol) {
    return (
      <EmptyState title="No market symbol selected">
        <p className="m-0 text-[13px] text-muted-foreground">Pick an instrument to load candles.</p>
      </EmptyState>
    );
  }

  return (
    <div className="market-chart">
      {showChrome ? (
        <header className="chrome">
          <p className="q">
            <span className="label">What?</span>
            {copy.question}
          </p>
          <p className="purpose">
            <span className="label">So what?</span>
            {copy.description}
          </p>
        </header>
      ) : null}
      {booting && !error ? <LoadingState label="Loading market data…" className="boot" /> : null}
      {error ? (
        <EmptyState title="Market data unavailable">
          <p className="m-0 text-[13px] text-muted-foreground">
            TraderOS could not retrieve {symbol} candles. Your journal data is unaffected.
          </p>
          <p className="m-0 mt-2 text-[12px] text-muted-foreground">{error}</p>
        </EmptyState>
      ) : null}
      <VelaChart
        symbol={symbol}
        height={height}
        onMeta={(m) => {
          setBooting(false);
          setError(m.error ?? null);
          onMeta?.(m);
        }}
        {...rest}
      />
      <style jsx>{`
        .market-chart {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
        }
        .chrome {
          display: grid;
          gap: 8px;
        }
        .label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 2px;
        }
        .q,
        .purpose {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .boot {
          margin: 0;
        }
      `}</style>
    </div>
  );
}

export type { DataMode };
