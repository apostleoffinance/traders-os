"use client";

import { VelaChart, type DataMode, type VelaChartProps } from "@/components/charts/vela/VelaChart";
import { LoadingState } from "@/components/trader/LoadingState";
import { EmptyState } from "@/components/trader/EmptyState";
import { useState } from "react";

export type MarketChartProps = Omit<VelaChartProps, "onMeta"> & {
  onMeta?: VelaChartProps["onMeta"];
  /** @deprecated Chrome removed — charts only. */
  showChrome?: boolean;
};

/** Owned market OHLCV surface — Vela behind the adapter. Chart first. */
export function MarketChart({
  showChrome: _showChrome = false,
  height = 560,
  symbol,
  onMeta,
  ...rest
}: MarketChartProps) {
  const [booting, setBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!symbol) {
    return (
      <EmptyState title="No symbol selected">
        <p className="m-0 text-[13px] text-muted-foreground">Pick an instrument.</p>
      </EmptyState>
    );
  }

  return (
    <div className="market-chart">
      {booting && !error ? <LoadingState label="Loading market data…" className="boot" /> : null}
      {error ? (
        <EmptyState title="Market data unavailable">
          <p className="m-0 text-[13px] text-muted-foreground">{error}</p>
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
        .boot {
          min-height: 48px;
        }
      `}</style>
    </div>
  );
}

export type { DataMode };
