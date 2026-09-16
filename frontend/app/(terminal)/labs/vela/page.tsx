"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MarketChart, type DataMode } from "@/components/visualizations/market/MarketChart";
import { MarketLabIntro } from "@/components/market/MarketLabIntro";
import { MarketSystemBridge } from "@/components/market/MarketSystemBridge";
import { Alert } from "@/components/ui";
import { LoadingState } from "@/components/trader/LoadingState";
import { EmptyState } from "@/components/trader/EmptyState";
import { api, getActiveAccountId } from "@/lib/api";
import {
  levelsFromReplay,
  levelsFromTrade,
  type TradeOverlayLevels,
} from "@/lib/chart/vela/tradeOverlay";
import { fetchMarketInstruments, fetchMarketStatus } from "@/lib/market-data/client";
import { POC_TIMEFRAMES, type VelaTimeframe } from "@/lib/market-data/timeframes";
import type { MarketInstrument, MarketStatusResponse } from "@/lib/market-data/types";
import type { Trade } from "@/lib/types";
import type { TradeReplay } from "@/lib/trade-replay";

const DEFAULT_FX = "EURUSD";
const DEFAULT_CRYPTO = "BTCUSDT";

export default function VelaLabPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading Market Lab…" />}>
      <MarketLab />
    </Suspense>
  );
}

function MarketLab() {
  const searchParams = useSearchParams();
  const initialTrade = searchParams.get("trade") || "";
  const [instruments, setInstruments] = useState<MarketInstrument[]>([]);
  const [status, setStatus] = useState<MarketStatusResponse | null>(null);
  const [symbol, setSymbol] = useState(
    () => (searchParams.get("symbol") || DEFAULT_FX).toUpperCase().replace("/", ""),
  );
  const [timeframe, setTimeframe] = useState<VelaTimeframe>("60");
  const [dataMode, setDataMode] = useState<DataMode>("naviq");
  const [preferredProvider, setPreferredProvider] = useState<string>("");
  const [showEma, setShowEma] = useState(true);
  const [showRsi, setShowRsi] = useState(true);
  const [live, setLive] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeId, setTradeId] = useState<string>(initialTrade);
  const [overlay, setOverlay] = useState<TradeOverlayLevels | null>(null);
  const [meta, setMeta] = useState<{
    backendProvider?: string;
    freshness?: string;
    stale?: boolean;
    warning?: string | null;
    count?: number;
    error?: string | null;
  }>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [inst, st] = await Promise.all([fetchMarketInstruments(), fetchMarketStatus()]);
        if (cancelled) return;
        setInstruments(inst);
        setStatus(st);
      } catch (e) {
        if (!cancelled) {
          setLoadError(
            e instanceof Error
              ? e.message
              : "TraderOS could not load the market instrument catalog.",
          );
        }
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const accountId = getActiveAccountId();
    if (!accountId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await api<Trade[]>(`/api/trades?account_id=${accountId}`);
        if (!cancelled) setTrades(rows.slice(0, 40));
      } catch {
        /* overlay is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyTradeOverlay = useCallback(async (id: string, tradeList: Trade[]) => {
    setTradeId(id);
    if (!id) {
      setOverlay(null);
      return;
    }
    const trade = tradeList.find((t) => t.id === id);
    try {
      const replay = await api<TradeReplay>(`/api/trades/${id}/replay`);
      setOverlay(levelsFromReplay(replay));
      if (trade?.symbol) {
        setSymbol(trade.symbol.toUpperCase().replace("/", ""));
        setDataMode("naviq");
      }
    } catch {
      if (trade) {
        setOverlay(levelsFromTrade(trade));
        if (trade.symbol) {
          setSymbol(trade.symbol.toUpperCase().replace("/", ""));
          setDataMode("naviq");
        }
      }
    }
  }, []);

  // Deep-link: ?trade=… once trades are loaded
  useEffect(() => {
    if (!initialTrade || trades.length === 0) return;
    void applyTradeOverlay(initialTrade, trades);
  }, [initialTrade, trades, applyTradeOverlay]);

  const selectedInstrument = useMemo(
    () => instruments.find((i) => i.symbol === symbol),
    [instruments, symbol],
  );

  const providerChoices = useMemo(() => {
    if (selectedInstrument?.providers?.length) return selectedInstrument.providers;
    if (status?.ohlcv) {
      const asset = selectedInstrument?.asset_class ?? (symbol.includes("USDT") ? "crypto" : "fx");
      return asset === "crypto" ? status.ohlcv.crypto_chain : status.ohlcv.fx_chain;
    }
    return [];
  }, [selectedInstrument, status, symbol]);

  const fxSymbols = instruments.filter((i) => i.asset_class === "fx").map((i) => i.symbol);
  const cryptoSymbols = instruments.filter((i) => i.asset_class === "crypto").map((i) => i.symbol);
  const symbolOptions =
    fxSymbols.length || cryptoSymbols.length
      ? [...fxSymbols, ...cryptoSymbols]
      : [DEFAULT_FX, "GBPUSD", "USDJPY", DEFAULT_CRYPTO, "ETHUSDT"];

  const onMeta = useCallback((m: typeof meta) => setMeta(m), []);

  return (
    <div className="market-lab">
      <MarketLabIntro />

      {catalogLoading ? <LoadingState label="Loading instruments…" /> : null}
      {loadError ? (
        <EmptyState title="Market catalog unavailable">
          <p className="hint">{loadError}</p>
          <p className="hint">Your existing journal data is unaffected. Retry after the market API is reachable.</p>
        </EmptyState>
      ) : null}
      {meta.error ? (
        <Alert kind="danger">
          Market data unavailable for {symbol}. {meta.error} Journal data is unaffected.
        </Alert>
      ) : null}
      {meta.warning ? <Alert kind="warn">{meta.warning}</Alert> : null}

      <section className="controls" aria-label="Market controls">
        <label>
          Symbol
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {symbolOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Timeframe
          <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as VelaTimeframe)}>
            {POC_TIMEFRAMES.map((tf) => (
              <option key={tf.vela} value={tf.vela}>
                {tf.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data path
          <select
            value={dataMode}
            onChange={(e) => {
              const next = e.target.value as DataMode;
              setDataMode(next);
              if (next === "vela-binance" && !symbol.includes("USDT")) setSymbol(DEFAULT_CRYPTO);
            }}
          >
            <option value="naviq">NAVIQ API (Dukascopy / CCXT)</option>
            <option value="vela-binance">Vela Binance (crypto only)</option>
          </select>
        </label>
        <label>
          Preferred provider
          <select
            value={preferredProvider}
            onChange={(e) => setPreferredProvider(e.target.value)}
            disabled={dataMode !== "naviq"}
          >
            <option value="">Auto chain</option>
            {providerChoices.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trade overlay
          <select value={tradeId} onChange={(e) => void applyTradeOverlay(e.target.value, trades)}>
            <option value="">None</option>
            {trades.map((t) => (
              <option key={t.id} value={t.id}>
                {t.symbol} · {t.direction} · {t.result || t.status}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Live poll
        </label>
        <label className="check">
          <input type="checkbox" checked={showEma} onChange={(e) => setShowEma(e.target.checked)} />
          EMA 20
        </label>
        <label className="check">
          <input type="checkbox" checked={showRsi} onChange={(e) => setShowRsi(e.target.checked)} />
          RSI 14
        </label>
      </section>

      <div className="meta-row">
        <span>
          Backend provider:{" "}
          <strong>{meta.backendProvider || (dataMode === "vela-binance" ? "binance (vela)" : "—")}</strong>
        </span>
        <span>
          Freshness: <strong>{meta.freshness || "—"}</strong>
          {meta.stale ? " (stale)" : ""}
        </span>
        <span>
          Bars: <strong>{meta.count ?? "—"}</strong>
        </span>
        {status?.ohlcv ? (
          <span>
            FX chain: {status.ohlcv.fx_chain.join(" → ") || "—"} · Crypto:{" "}
            {status.ohlcv.crypto_chain.join(" → ") || "—"}
          </span>
        ) : null}
      </div>

      <MarketChart
        key={`${showEma}-${showRsi}-${dataMode}`}
        symbol={symbol}
        timeframe={timeframe}
        dataMode={dataMode}
        preferredProvider={preferredProvider || null}
        live={live}
        showEma={showEma}
        showRsi={showRsi}
        tradeOverlay={overlay}
        height={580}
        onMeta={onMeta}
        showChrome
      />

      <MarketSystemBridge tradeId={tradeId || undefined} symbol={symbol} />

      <section className="notes">
        <h2>POC notes</h2>
        <ul>
          <li>
            Route stays <code>/labs/vela</code> — no product <code>/market</code> until the POC is ready.
          </li>
          <li>
            Candles from <code>GET /api/market/ohlcv</code>. Deep-link with <code>?trade=</code> /{" "}
            <code>?symbol=</code>.
          </li>
          <li>Trade overlay paints Entry / SL / TP / Exit. Native EMA/RSI only (no AGPL pinets).</li>
        </ul>
      </section>

      <style jsx>{`
        .market-lab {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 1200px;
        }
        .hint {
          margin: 0 0 6px;
          font-size: 13px;
          color: var(--text-muted);
        }
        .controls {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 16px;
          align-items: end;
        }
        .controls label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .controls select {
          min-width: 140px;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--text-primary);
        }
        .controls .check {
          flex-direction: row;
          align-items: center;
          gap: 8px;
          padding-bottom: 8px;
          color: var(--text-primary);
          font-size: 0.85rem;
        }
        .meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 20px;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .meta-row strong {
          color: var(--text-primary);
          font-weight: 600;
        }
        .notes {
          margin-top: 4px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .notes h2 {
          margin: 0 0 8px;
          font-size: 1rem;
        }
        .notes ul {
          margin: 0;
          padding-left: 1.2rem;
          color: var(--text-secondary, var(--text-muted));
          font-size: 0.9rem;
          line-height: 1.5;
        }
        code {
          font-size: 0.85em;
        }
      `}</style>
    </div>
  );
}
