"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { VelaChart, type DataMode } from "@/components/charts/vela/VelaChart";
import { Alert } from "@/components/ui";
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
    <Suspense fallback={<p className="muted">Loading Vela lab…</p>}>
      <VelaLab />
    </Suspense>
  );
}

function VelaLab() {
  const searchParams = useSearchParams();
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
  const [tradeId, setTradeId] = useState<string>("");
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [inst, st] = await Promise.all([fetchMarketInstruments(), fetchMarketStatus()]);
        if (cancelled) return;
        setInstruments(inst);
        setStatus(st);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Failed to load market catalog");
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

  async function applyTradeOverlay(id: string) {
    setTradeId(id);
    if (!id) {
      setOverlay(null);
      return;
    }
    const trade = trades.find((t) => t.id === id);
    try {
      const replay = await api<TradeReplay>(`/api/trades/${id}/replay`);
      const levels = levelsFromReplay(replay);
      setOverlay(levels);
      if (trade?.symbol) {
        setSymbol(trade.symbol.toUpperCase().replace("/", ""));
        setDataMode("naviq");
      }
    } catch {
      if (trade) setOverlay(levelsFromTrade(trade));
    }
  }

  return (
    <div className="vela-lab">
      <header className="vela-lab-head">
        <div>
          <p className="eyebrow">Labs · Chart POC</p>
          <h1>Vela chart</h1>
          <p className="lede">
            Provider-agnostic candles via NAVIQ market data. ECharts analytics stay unchanged —
            this route isolates <code>@luxalgo/vela</code> behind an adapter.
          </p>
        </div>
      </header>

      {loadError ? <Alert kind="danger">{loadError}</Alert> : null}
      {meta.error ? <Alert kind="danger">{meta.error}</Alert> : null}
      {meta.warning ? <Alert kind="warn">{meta.warning}</Alert> : null}

      <div className="controls">
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
          <select value={tradeId} onChange={(e) => void applyTradeOverlay(e.target.value)}>
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
      </div>

      <div className="meta-row">
        <span>
          Backend provider: <strong>{meta.backendProvider || (dataMode === "vela-binance" ? "binance (vela)" : "—")}</strong>
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

      {/* Remount when indicator toggles change so addNativeIndicator runs cleanly */}
      <VelaChart
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
      />

      <section className="notes">
        <h2>POC notes</h2>
        <ul>
          <li>Candles come from <code>GET /api/market/ohlcv</code> (optional <code>provider=</code>).</li>
          <li>Forex: Dukascopy primary. Crypto: CCXT; optional direct Vela Binance for comparison.</li>
          <li>Drawings toolbar is enabled; trade overlay paints Entry / SL / TP / Exit hlines.</li>
          <li>Do not use <code>@luxalgo/vela-pinets</code> (AGPL). Native EMA/RSI only.</li>
        </ul>
      </section>

      <style jsx>{`
        .vela-lab {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-width: 1200px;
        }
        .vela-lab-head h1 {
          margin: 4px 0 8px;
          font-size: 1.65rem;
          letter-spacing: -0.02em;
        }
        .eyebrow {
          margin: 0;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-muted);
        }
        .lede {
          margin: 0;
          max-width: 62ch;
          color: var(--text-secondary, var(--text-muted));
          line-height: 1.45;
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
          margin-top: 8px;
          padding-top: 8px;
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
