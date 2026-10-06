"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api";

type ReplayCandle = {
  symbol: string;
  provider: string;
  timeframe: string;
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string | null;
};

type ReplaySeries = {
  symbol: string;
  asset_class: string;
  provider: string;
  count: number;
  first_timestamp: string;
  last_timestamp: string;
  candles: ReplayCandle[];
};

type ReplayEvent = {
  timestamp: string;
  symbol: string;
  provider: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string | null;
};

type ReplayResponse = {
  status: string;
  mode: string;
  window: { start: string; end: string; timezone: string };
  timeframe: string;
  persisted_to: string;
  series: ReplaySeries[];
  timeline: ReplayEvent[];
  timeline_count: number;
  caveats: string[];
};

const DEFAULT_START = "2026-09-01T08:00";
const DEFAULT_END = "2026-09-01T12:00";

function asUtc(value: string): string {
  return new Date(value + ":00Z").toISOString();
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }) + " UTC";
}

function CandleChart({ series, cursorTimestamp }: { series: ReplaySeries; cursorTimestamp: string }) {
  const bars = useMemo(
    () => series.candles.filter((bar) => bar.timestamp <= cursorTimestamp),
    [series.candles, cursorTimestamp],
  );
  if (!bars.length) {
    return <div className="chart-empty">No candles reached at this replay position.</div>;
  }

  const lows = bars.map((bar) => Number(bar.low));
  const highs = bars.map((bar) => Number(bar.high));
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = max - min || Math.max(Math.abs(max) * 0.0001, 0.00001);
  const plotTop = 18;
  const plotBottom = 218;
  const plotHeight = plotBottom - plotTop;
  const step = 700 / Math.max(bars.length, 1);
  const candleWidth = Math.max(2, Math.min(12, step * 0.58));
  const y = (price: number) => plotBottom - ((price - min) / span) * plotHeight;

  return (
    <div className="chart-wrap">
      <div className="chart-price">
        <span>{bars.length} / {series.count} bars</span>
        <strong>{Number(bars[bars.length - 1].close).toLocaleString("en-US", { maximumFractionDigits: 8 })}</strong>
      </div>
      <svg viewBox="0 0 760 250" role="img" aria-label={series.symbol + " historical candle replay"}>
        {[0, 1, 2, 3, 4].map((n) => {
          const gridY = plotTop + (plotHeight / 4) * n;
          const price = max - ((max - min) / 4) * n;
          return (
            <g key={n}>
              <line x1="34" x2="738" y1={gridY} y2={gridY} className="chart-grid" />
              <text x="30" y={gridY - 4} textAnchor="end" className="chart-label">
                {price.toLocaleString("en-US", { maximumFractionDigits: 6 })}
              </text>
            </g>
          );
        })}
        {bars.map((bar, index) => {
          const open = Number(bar.open);
          const close = Number(bar.close);
          const high = Number(bar.high);
          const low = Number(bar.low);
          const x = 38 + step * (index + 0.5);
          const top = Math.min(y(open), y(close));
          const height = Math.max(1.5, Math.abs(y(open) - y(close)));
          const direction = close >= open ? "up" : "down";
          return (
            <g key={bar.timestamp}>
              <line x1={x} x2={x} y1={y(high)} y2={y(low)} className={"candle-wick " + direction} />
              <rect
                x={x - candleWidth / 2}
                y={top}
                width={candleWidth}
                height={height}
                className={"candle-body " + direction}
                rx="0.7"
              />
            </g>
          );
        })}
      </svg>
      <div className="chart-axis">
        <span>{formatTime(bars[0].timestamp)}</span>
        <span>{formatTime(bars[bars.length - 1].timestamp)}</span>
      </div>
    </div>
  );
}

export default function MarketReplayPage() {
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState(DEFAULT_END);
  const [timeframe, setTimeframe] = useState("M5");
  const [fxSymbol, setFxSymbol] = useState("EURUSD");
  const [cryptoSymbol, setCryptoSymbol] = useState("BTCUSDT");
  const [result, setResult] = useState<ReplayResponse | null>(null);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentEvent = result?.timeline[Math.min(cursor, Math.max(0, (result?.timeline.length ?? 1) - 1))];
  const cursorTimestamp = currentEvent?.timestamp ?? result?.window.start ?? "";

  useEffect(() => {
    if (!playing || !result) return;
    const timer = window.setInterval(() => {
      setCursor((value) => {
        if (value >= result.timeline.length - 1) {
          setPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [playing, result]);

  async function runReplay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setPlaying(false);
    setResult(null);
    try {
      const payload = await api<ReplayResponse>("/api/market/replay-window", {
        method: "POST",
        body: JSON.stringify({
          symbols: [fxSymbol, cryptoSymbol],
          timeframe,
          start: asUtc(start),
          end: asUtc(end),
          limit: 1000,
        }),
      });
      setResult(payload);
      setCursor(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "TraderOS could not load this replay window.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="replay-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">MARKET WORKSTATION / REPLAY</p>
          <h1>Cross-asset market replay</h1>
          <p className="lede">
            Load historical FX and crypto candles into TraderOS, persist the source evidence, and step through one shared UTC timeline.
          </p>
        </div>
        <span className="status-pill"><span /> Historical mode</span>
      </header>

      <form className="replay-controls" onSubmit={runReplay}>
        <label>
          FX instrument
          <select value={fxSymbol} onChange={(event) => setFxSymbol(event.target.value)}>
            <option value="EURUSD">EURUSD</option>
            <option value="GBPUSD">GBPUSD</option>
            <option value="USDJPY">USDJPY</option>
          </select>
        </label>
        <label>
          Crypto instrument
          <select value={cryptoSymbol} onChange={(event) => setCryptoSymbol(event.target.value)}>
            <option value="BTCUSDT">BTC / USDT</option>
            <option value="ETHUSDT">ETH / USDT</option>
            <option value="SOLUSDT">SOL / USDT</option>
          </select>
        </label>
        <label>
          Candle interval
          <select value={timeframe} onChange={(event) => setTimeframe(event.target.value)}>
            <option value="M1">1 minute</option>
            <option value="M5">5 minutes</option>
            <option value="M15">15 minutes</option>
            <option value="M30">30 minutes</option>
            <option value="H1">1 hour</option>
          </select>
        </label>
        <label>
          Start (UTC)
          <input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required />
        </label>
        <label>
          End (UTC)
          <input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Loading historical data…" : "Load & persist replay"}
        </button>
      </form>

      <p className="source-note">
        Data is fetched from TraderOS&apos;s configured FX and crypto providers. Input times are interpreted as UTC, not browser-local time.
      </p>
      {error ? <div className="error-panel" role="alert">{error}</div> : null}

      {!result && !loading && !error ? (
        <section className="empty-panel">
          <div className="empty-mark">↻</div>
          <h2>Build a replay window</h2>
          <p>Choose an interval where both markets have historical candles. TraderOS will store both series before opening the replay timeline.</p>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="replay-summary">
            <div><span>Replay window</span><strong>{formatTime(result.window.start)} — {formatTime(result.window.end)}</strong></div>
            <div><span>Timeframe</span><strong>{result.timeframe}</strong></div>
            <div><span>Timeline events</span><strong>{result.timeline_count.toLocaleString()}</strong></div>
            <div><span>Persistence</span><strong>{result.persisted_to}</strong></div>
          </section>

          <section className="transport" aria-label="Replay controls">
            <div className="transport-buttons">
              <button type="button" onClick={() => { setPlaying(false); setCursor(0); }} disabled={!result.timeline.length} aria-label="Restart replay">↤</button>
              <button type="button" onClick={() => setPlaying((value) => !value)} disabled={result.timeline.length < 2}>
                {playing ? "Pause" : "Play"}
              </button>
              <button type="button" onClick={() => { setPlaying(false); setCursor((value) => Math.max(0, value - 1)); }} disabled={cursor <= 0} aria-label="Previous event">←</button>
              <button type="button" onClick={() => { setPlaying(false); setCursor((value) => Math.min(result.timeline.length - 1, value + 1)); }} disabled={cursor >= result.timeline.length - 1} aria-label="Next event">→</button>
            </div>
            <div className="scrubber">
              <div className="scrubber-heading"><span>Replay cursor</span><strong>{cursor + 1} / {result.timeline_count}</strong></div>
              <input
                type="range"
                min={0}
                max={Math.max(0, result.timeline_count - 1)}
                value={cursor}
                onChange={(event) => { setPlaying(false); setCursor(Number(event.target.value)); }}
                aria-label="Replay timeline position"
              />
              <div className="scrubber-time"><span>{formatTime(result.window.start)}</span><strong>{cursorTimestamp ? formatTime(cursorTimestamp) : "—"}</strong><span>{formatTime(result.window.end)}</span></div>
            </div>
          </section>

          <section className="series-grid">
            {result.series.map((series) => (
              <article className="series-card" key={series.symbol}>
                <header>
                  <div><span>{series.asset_class.toUpperCase()}</span><h2>{series.symbol}</h2></div>
                  <div className="series-provider"><strong>{series.provider}</strong><small>{series.count} candles stored</small></div>
                </header>
                <CandleChart series={series} cursorTimestamp={cursorTimestamp} />
                <footer>{formatTime(series.first_timestamp)} <span>to</span> {formatTime(series.last_timestamp)}</footer>
              </article>
            ))}
          </section>

          <section className="event-panel">
            <div><p className="eyebrow">CURRENT EVENT</p><h2>{currentEvent?.symbol ?? "No event"}</h2></div>
            <div className="event-time">{currentEvent ? formatTime(currentEvent.timestamp) : "—"}</div>
            <dl>
              <div><dt>Open</dt><dd>{currentEvent?.open ?? "—"}</dd></div>
              <div><dt>High</dt><dd>{currentEvent?.high ?? "—"}</dd></div>
              <div><dt>Low</dt><dd>{currentEvent?.low ?? "—"}</dd></div>
              <div><dt>Close</dt><dd>{currentEvent?.close ?? "—"}</dd></div>
              <div><dt>Source</dt><dd>{currentEvent?.provider ?? "—"}</dd></div>
            </dl>
          </section>

          <section className="caveats">
            <h2>Replay precision and source notes</h2>
            <ul>{result.caveats.map((note) => <li key={note}>{note}</li>)}</ul>
          </section>
        </>
      ) : null}

      <style jsx>{`
        .replay-page { display: flex; flex-direction: column; gap: 18px; max-width: 1440px; color: var(--text-primary); }
        .page-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
        .eyebrow { margin: 0 0 7px; color: var(--accent, #0f766e); font-size: 10px; font-weight: 800; letter-spacing: .14em; }
        h1 { margin: 0; font-size: clamp(1.6rem, 3vw, 2.2rem); letter-spacing: -.045em; }
        .lede { max-width: 740px; margin: 9px 0 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
        .status-pill { display: inline-flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 999px; white-space: nowrap; font-size: 11px; color: var(--text-muted); }
        .status-pill span { width: 7px; height: 7px; border-radius: 50%; background: #0d9488; }
        .replay-controls { display: flex; align-items: end; flex-wrap: wrap; gap: 12px; padding: 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
        label { display: flex; flex-direction: column; gap: 6px; color: var(--text-muted); font-size: 11px; min-width: 120px; }
        select, input[type="datetime-local"] { max-width: 100%; min-width: 125px; padding: 9px 10px; color: var(--text-primary); background: var(--bg); border: 1px solid var(--border); border-radius: 7px; font: inherit; font-size: 12px; }
        button { border: 1px solid var(--border); border-radius: 8px; padding: 9px 13px; background: var(--text-primary); color: var(--bg); font-size: 12px; font-weight: 700; cursor: pointer; }
        button:disabled { opacity: .45; cursor: not-allowed; }
        .source-note { margin: -8px 0 0; font-size: 11px; color: var(--text-muted); }
        .error-panel { padding: 13px 15px; border: 1px solid #ef444455; border-radius: 9px; color: #b91c1c; background: #fef2f2; font-size: 13px; }
        .empty-panel { display: grid; justify-items: center; text-align: center; padding: 60px 20px; border: 1px dashed var(--border); border-radius: 14px; background: var(--surface); }
        .empty-mark { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: var(--surface-muted, var(--bg)); font-size: 28px; color: var(--accent, #0f766e); }
        .empty-panel h2 { margin: 14px 0 5px; font-size: 16px; }
        .empty-panel p { max-width: 480px; margin: 0; color: var(--text-muted); font-size: 12px; line-height: 1.6; }
        .replay-summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .replay-summary > div { display: flex; flex-direction: column; gap: 7px; padding: 13px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); min-width: 0; }
        .replay-summary span { color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .07em; }
        .replay-summary strong { overflow-wrap: anywhere; font-size: 12px; font-weight: 700; }
        .transport { display: flex; align-items: center; gap: 20px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
        .transport-buttons { display: flex; align-items: center; gap: 7px; }
        .transport-buttons button { min-width: 38px; background: var(--bg); color: var(--text-primary); }
        .transport-buttons button:nth-child(2) { background: var(--accent, #0f766e); color: white; border-color: transparent; }
        .scrubber { flex: 1; min-width: 0; }
        .scrubber-heading, .scrubber-time { display: flex; justify-content: space-between; gap: 10px; color: var(--text-muted); font-size: 10px; }
        .scrubber-heading strong, .scrubber-time strong { color: var(--text-primary); font-weight: 700; }
        input[type="range"] { width: 100%; margin: 10px 0 7px; accent-color: var(--accent, #0f766e); }
        .series-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .series-card { min-width: 0; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); padding: 15px; }
        .series-card > header { display: flex; justify-content: space-between; gap: 12px; }
        .series-card header span { color: var(--text-muted); font-size: 9px; letter-spacing: .12em; }
        .series-card h2 { margin: 4px 0 0; font-size: 16px; }
        .series-provider { display: flex; flex-direction: column; align-items: end; gap: 4px; font-size: 11px; }
        .series-provider small { color: var(--text-muted); font-size: 10px; }
        .chart-wrap { margin-top: 10px; min-width: 0; }
        .chart-price, .chart-axis { display: flex; justify-content: space-between; gap: 8px; color: var(--text-muted); font-size: 10px; }
        .chart-price strong { color: var(--text-primary); }
        svg { display: block; width: 100%; height: auto; margin-top: 6px; overflow: visible; }
        .chart-grid { stroke: var(--border); stroke-dasharray: 3 4; stroke-width: .8; }
        .chart-label { fill: var(--text-muted); font-size: 9px; }
        .candle-wick { stroke-width: 1.2; }
        .candle-wick.up { stroke: #0d9488; }
        .candle-wick.down { stroke: #e05252; }
        .candle-body.up { fill: #0d9488; stroke: #0d9488; }
        .candle-body.down { fill: #e05252; stroke: #e05252; }
        .chart-empty { display: grid; place-items: center; min-height: 230px; color: var(--text-muted); font-size: 12px; }
        .series-card footer { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; color: var(--text-muted); font-size: 9px; }
        .event-panel, .caveats { padding: 15px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
        .event-panel { display: grid; grid-template-columns: auto 1fr; gap: 8px 18px; align-items: center; }
        .event-panel h2 { margin: 0; font-size: 15px; }
        .event-time { justify-self: end; color: var(--text-muted); font-size: 11px; }
        dl { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin: 5px 0 0; }
        dl div { min-width: 0; }
        dt { color: var(--text-muted); font-size: 10px; }
        dd { margin: 4px 0 0; overflow-wrap: anywhere; font-size: 12px; font-weight: 700; }
        .caveats h2 { margin: 0 0 8px; font-size: 13px; }
        .caveats ul { margin: 0; padding-left: 18px; color: var(--text-muted); font-size: 11px; line-height: 1.8; }
        @media (max-width: 900px) { .replay-controls { align-items: stretch; } .replay-controls label { flex: 1 1 140px; } .replay-controls > button { align-self: end; } .series-grid { grid-template-columns: 1fr; } .replay-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 600px) { .page-heading { flex-direction: column; } .transport { align-items: stretch; flex-direction: column; gap: 14px; } .transport-buttons { justify-content: space-between; } .replay-summary { grid-template-columns: 1fr 1fr; } dl { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      `}</style>
    </main>
  );
}
