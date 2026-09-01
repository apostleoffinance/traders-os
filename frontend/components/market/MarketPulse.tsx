"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { MARKET_PULSE_SCROLL_PX_PER_SEC } from "@/lib/market";
import { MarketPulseItem } from "@/components/market/MarketPulseItem";
import { MarketPulseSkeleton } from "@/components/market/MarketPulseSkeleton";

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

export function MarketPulse() {
  const { quotes, loading, error } = useMarketQuotes();
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const seqRef = useRef<HTMLDivElement>(null);
  const [durationSec, setDurationSec] = useState(60);

  const visible = useMemo(() => quotes.filter((q) => q.status !== "unavailable"), [quotes]);

  useEffect(() => {
    if (reducedMotion || visible.length === 0) return;
    const el = seqRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.offsetWidth;
      if (width > 0) {
        setDurationSec(Math.max(24, width / MARKET_PULSE_SCROLL_PX_PER_SEC));
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible.length, reducedMotion]);

  const showSkeleton = loading && visible.length === 0;
  const showFallback = !loading && visible.length === 0;

  return (
    <section className="pulse" aria-label="Market Pulse live prices">
      {showSkeleton && <MarketPulseSkeleton />}
      {showFallback && (
        <p className="fallback muted">{error ? "Market data temporarily unavailable" : "Loading market data…"}</p>
      )}
      {visible.length > 0 && (
        <div
          className={`viewport${reducedMotion ? " reduced" : ""}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className={`track${paused ? " paused" : ""}`}
            style={reducedMotion ? undefined : ({ "--pulse-duration": `${durationSec}s` } as CSSProperties)}
          >
            <div className="sequence" ref={seqRef}>
              {visible.map((q) => (
                <MarketPulseItem key={`${q.symbol}-a`} quote={q} />
              ))}
            </div>
            {!reducedMotion && (
              <div className="sequence" aria-hidden>
                {visible.map((q) => (
                  <MarketPulseItem key={`${q.symbol}-b`} quote={q} tabbable={false} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <style jsx global>{`
        .market-pulse__item {
          display: inline-flex;
          align-items: center;
          flex-shrink: 0;
          padding: 0 26px;
          height: 100%;
          white-space: nowrap;
          text-decoration: none;
          color: inherit;
          line-height: 1;
          border-right: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
        }
        .market-pulse__item:hover {
          background: color-mix(in srgb, var(--accent) 4%, transparent);
        }
        .market-pulse__symbol {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-primary);
          margin-right: 8px;
        }
        .market-pulse__price {
          font-size: 11px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          color: var(--text-primary);
          margin-right: 7px;
        }
        .market-pulse__change {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10px;
          font-weight: 600;
          line-height: 1;
        }
        .market-pulse__change--up {
          color: var(--success);
        }
        .market-pulse__change--down {
          color: var(--danger);
        }
        .market-pulse__change--flat {
          color: var(--text-muted);
        }
        @media (max-width: 640px) {
          .market-pulse__item {
            padding: 0 18px;
          }
          .market-pulse__symbol {
            margin-right: 6px;
          }
          .market-pulse__price {
            margin-right: 6px;
          }
        }
      `}</style>
      <style jsx>{`
        .pulse {
          height: 42px;
          border-bottom: 1px solid var(--border);
          background: color-mix(in srgb, var(--surface-2, var(--surface)) 35%, var(--surface));
          overflow: hidden;
          flex-shrink: 0;
        }
        .fallback {
          margin: 0;
          padding: 0 16px;
          font-size: 11px;
          line-height: 42px;
        }
        .viewport {
          height: 100%;
          overflow: hidden;
          mask-image: linear-gradient(90deg, transparent, #000 24px, #000 calc(100% - 24px), transparent);
        }
        .viewport.reduced {
          overflow-x: auto;
          mask-image: none;
        }
        .track {
          display: flex;
          width: max-content;
          height: 100%;
          animation: pulse-scroll var(--pulse-duration, 60s) linear infinite;
        }
        .track.paused {
          animation-play-state: paused;
        }
        .viewport.reduced .track {
          animation: none;
        }
        .sequence {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }
        @keyframes pulse-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
        @media (max-width: 640px) {
          .pulse {
            height: 38px;
          }
          .fallback {
            line-height: 38px;
          }
        }
      `}</style>
    </section>
  );
}
