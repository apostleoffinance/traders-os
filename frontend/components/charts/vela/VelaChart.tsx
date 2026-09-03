"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { NAVIQ_PROVIDER_ID, NaviqDataProvider } from "@/lib/chart/vela/naviqProvider";
import {
  applyTradeOverlay,
  clearTradeOverlay,
  type TradeOverlayLevels,
} from "@/lib/chart/vela/tradeOverlay";
import type { VelaTimeframe } from "@/lib/market-data/timeframes";

export type DataMode = "naviq" | "vela-binance";

export type VelaChartProps = {
  symbol: string;
  timeframe: VelaTimeframe;
  dataMode: DataMode;
  preferredProvider?: string | null;
  live?: boolean;
  showEma?: boolean;
  showRsi?: boolean;
  tradeOverlay?: TradeOverlayLevels | null;
  height?: number;
  onMeta?: (meta: {
    backendProvider?: string;
    freshness?: string;
    stale?: boolean;
    warning?: string | null;
    count?: number;
    error?: string | null;
  }) => void;
};

type ChartHandle = {
  destroy: () => void;
  setMarket: (next: { symbol?: string; timeframe?: string; live?: boolean }) => Promise<void>;
  setTheme: (theme: "dark" | "light") => unknown;
  addNativeIndicator: (type: string, options?: { inputs?: Record<string, unknown> }) => { remove?: () => void };
  indicators: () => { remove?: () => void }[];
  drawings: {
    add: (type: string, init?: unknown) => { id: string } | null;
    remove: (id: string) => void;
    showToolbar: (visible: boolean) => void;
  };
  ready: () => Promise<void>;
  resize: () => void;
  data: {
    registerProvider: (name: string, provider: unknown) => Promise<void>;
  };
};

/**
 * Isolated Vela chart host. All @luxalgo/vela imports stay behind this adapter so
 * ECharts analytics charts are untouched. Do not import Vela from product pages
 * except through this component.
 */
export function VelaChart({
  symbol,
  timeframe,
  dataMode,
  preferredProvider = null,
  live = true,
  showEma = true,
  showRsi = true,
  tradeOverlay = null,
  height = 560,
  onMeta,
}: VelaChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartHandle | null>(null);
  const providerRef = useRef<NaviqDataProvider | null>(null);
  const overlayIdsRef = useRef<string[]>([]);
  const { resolved } = useTheme();
  const [bootError, setBootError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Boot chart once
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let cancelled = false;

    (async () => {
      try {
        const { Vela } = await import("@luxalgo/vela");
        if (cancelled || !hostRef.current) return;

        const naviq = new NaviqDataProvider({
          preferredProvider,
          onMeta: (m) =>
            onMeta?.({
              backendProvider: m.provider,
              freshness: m.freshness,
              stale: m.stale,
              warning: m.warning,
              count: m.count,
              error: null,
            }),
        });
        providerRef.current = naviq;

        const velaSymbol =
          dataMode === "vela-binance"
            ? `binance:${symbol.replace("/", "").toUpperCase()}`
            : `${NAVIQ_PROVIDER_ID}:${symbol.replace("/", "").toUpperCase()}`;

        const chart = new Vela(hostRef.current, {
          symbol: velaSymbol,
          timeframe,
          live,
          theme: resolved === "light" ? "light" : "dark",
          drawings: true,
          height,
        }) as unknown as ChartHandle;

        chartRef.current = chart;
        await chart.data.registerProvider(NAVIQ_PROVIDER_ID, naviq);

        if (dataMode === "vela-binance") {
          const { BinanceProvider } = await import("@luxalgo/vela/providers/binance");
          await chart.data.registerProvider("binance", new BinanceProvider());
        }

        await chart.ready();
        if (cancelled) {
          chart.destroy();
          return;
        }

        chart.drawings.showToolbar(true);
        if (showEma) {
          try {
            chart.addNativeIndicator("ema", { inputs: { length: 20 } });
          } catch {
            /* optional */
          }
        }
        if (showRsi) {
          try {
            chart.addNativeIndicator("rsi", { inputs: { length: 14 } });
          } catch {
            /* optional */
          }
        }

        setReady(true);
        setBootError(null);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to start Vela chart";
          setBootError(msg);
          onMeta?.({ error: msg });
        }
      }
    })();

    return () => {
      cancelled = true;
      setReady(false);
      const chart = chartRef.current;
      chartRef.current = null;
      providerRef.current = null;
      if (chart) {
        try {
          chart.destroy();
        } catch {
          /* ignore */
        }
      }
    };
    // Intentionally boot once; market/theme updates handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme
  useEffect(() => {
    chartRef.current?.setTheme(resolved === "light" ? "light" : "dark");
  }, [resolved]);

  // Preferred provider on NAVIQ feed
  useEffect(() => {
    providerRef.current?.setPreferredProvider(preferredProvider ?? null);
  }, [preferredProvider]);

  // Symbol / timeframe / data mode switches
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    let cancelled = false;

    (async () => {
      try {
        if (dataMode === "vela-binance") {
          try {
            const { BinanceProvider } = await import("@luxalgo/vela/providers/binance");
            await chart.data.registerProvider("binance", new BinanceProvider());
          } catch {
            /* may already be registered */
          }
        }
        const velaSymbol =
          dataMode === "vela-binance"
            ? `binance:${symbol.replace("/", "").toUpperCase()}`
            : `${NAVIQ_PROVIDER_ID}:${symbol.replace("/", "").toUpperCase()}`;
        await chart.setMarket({ symbol: velaSymbol, timeframe, live });
        if (!cancelled) onMeta?.({ error: null });
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Market switch failed";
          onMeta?.({ error: msg });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, dataMode, live, ready, onMeta]);

  // Trade overlay
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !ready) return;
    clearTradeOverlay(chart.drawings, overlayIdsRef.current);
    overlayIdsRef.current = [];
    if (!tradeOverlay) return;
    const anchor =
      tradeOverlay.entryTimeMs && Number.isFinite(tradeOverlay.entryTimeMs)
        ? tradeOverlay.entryTimeMs
        : Date.now();
    overlayIdsRef.current = applyTradeOverlay(chart.drawings, tradeOverlay, anchor);
  }, [tradeOverlay, ready]);

  // Resize
  useEffect(() => {
    const onResize = () => chartRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="vela-host" style={{ height }}>
      <div ref={hostRef} className="vela-canvas" style={{ height: "100%", width: "100%" }} />
      {bootError ? <p className="vela-error">{bootError}</p> : null}
      <p className="vela-attr">
        Chart powered by{" "}
        <a href="https://luxalgo.com/vela" target="_blank" rel="noreferrer">
          Vela
        </a>
      </p>
      <style jsx>{`
        .vela-host {
          position: relative;
          width: 100%;
          min-height: 320px;
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          background: var(--surface);
        }
        .vela-canvas {
          min-height: 280px;
        }
        .vela-error {
          position: absolute;
          inset: 12px;
          margin: 0;
          padding: 12px 14px;
          border-radius: 8px;
          background: color-mix(in srgb, var(--danger, #ef4444) 12%, var(--surface));
          color: var(--text-primary);
          font-size: 0.9rem;
          z-index: 2;
        }
        .vela-attr {
          position: absolute;
          right: 10px;
          bottom: 6px;
          margin: 0;
          font-size: 0.7rem;
          color: var(--text-muted, #888);
          z-index: 1;
          pointer-events: auto;
        }
        .vela-attr a {
          color: inherit;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
