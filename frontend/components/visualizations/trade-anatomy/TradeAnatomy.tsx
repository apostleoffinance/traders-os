"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnatomyChart } from "./AnatomyChart";
import { InsightCard } from "@/components/trader/InsightCard";
import {
  buildTradeAnatomyModel,
  pointAtProgress,
  type AnatomyPoint,
  type TradeAnatomyFallbacks,
  type TradeAnatomyModel,
} from "@/lib/trade-anatomy";
import type { TradeReplay } from "@/lib/trade-replay";
import type { AnalyticsInsight } from "@/lib/analytics/types";
import { holdingLabel, num, signed, tone } from "@/lib/format";

const PLAY_MS = 3200;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Metric({
  label,
  value,
  hint,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="metric">
      <span className="label">{label}</span>
      <span className={`value num ${valueClass ?? ""}`}>{value}</span>
      {hint && <span className="hint">{hint}</span>}
      <style jsx>{`
        .metric {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .label {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
        }
        .value {
          font-size: 16px;
          font-weight: 700;
          line-height: 1.2;
        }
        .hint {
          font-size: 11px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}

function toInsight(model: TradeAnatomyModel): AnalyticsInsight {
  return {
    summary: model.story.what,
    observation: model.story.soWhat,
    takeaway: model.story.nowWhat,
    direction: model.story.direction,
    warning: model.story.warning,
    strength: model.hasExcursions ? "moderate" : "early",
    sampleSize: 1,
  };
}

export function TradeAnatomy({
  replay,
  fallbacks,
  compact = false,
}: {
  replay: TradeReplay;
  fallbacks?: TradeAnatomyFallbacks;
  compact?: boolean;
}) {
  const model = useMemo(() => buildTradeAnatomyModel(replay, fallbacks), [replay, fallbacks]);
  const [progress, setProgress] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [activeId, setActiveId] = useState<AnatomyPoint["id"] | null>("exit");
  const raf = useRef<number | null>(null);
  const playStart = useRef<number>(0);
  const playFrom = useRef(0);

  useEffect(() => {
    // Closed trades start fully revealed; open trades stay at entry.
    setProgress(model.status === "closed" ? 1 : 0);
    setActiveId(model.status === "closed" ? "exit" : "entry");
  }, [model.symbol, model.status, replay.trade_id]);

  useEffect(() => {
    if (!playing) {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      return;
    }
    if (prefersReducedMotion()) {
      setProgress(1);
      setPlaying(false);
      setActiveId("exit");
      return;
    }
    playStart.current = performance.now();
    playFrom.current = progress;

    const tick = (now: number) => {
      const elapsed = now - playStart.current;
      const span = Math.max(0.05, 1 - playFrom.current);
      const next = playFrom.current + (elapsed / PLAY_MS) * span;
      if (next >= 1) {
        setProgress(1);
        setPlaying(false);
        setActiveId("exit");
        return;
      }
      setProgress(next);
      const nearest = model.path.reduce((best, p) =>
        Math.abs(p.t - next) < Math.abs(best.t - next) ? p : best,
      );
      setActiveId(nearest.id);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
    // intentionally omit progress — captured via playFrom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, model.path]);

  const activePoint = model.path.find((p) => p.id === activeId) ?? null;
  const scrub = useMemo(
    () => pointAtProgress(model.path, progress, 480, 280, 52, 28, model.series),
    [model.path, model.series, progress],
  );
  const m = model.metrics;

  const onSelectPoint = (id: AnatomyPoint["id"]) => {
    setPlaying(false);
    const pt = model.path.find((p) => p.id === id);
    if (pt) {
      setProgress(pt.t);
      setActiveId(id);
    }
  };

  return (
    <div className={`trade-anatomy ${compact ? "compact" : ""}`}>
      <div className="metrics" role="group" aria-label="Trade anatomy metrics">
        <Metric
          label="Planned"
          value={m.plannedR != null ? `1:${num(m.plannedR, 2)}` : "—"}
        />
        <Metric
          label="Realized"
          value={m.realizedR != null ? signed(m.realizedR, "R") : "—"}
          valueClass={tone(m.realizedR)}
        />
        <Metric
          label="MFE"
          value={m.mfeR != null ? signed(m.mfeR, "R") : "—"}
          valueClass={tone(m.mfeR)}
          hint={m.mfeR == null ? "Not enriched" : undefined}
        />
        <Metric
          label="MAE"
          value={m.maeR != null ? signed(m.maeR, "R") : "—"}
          valueClass={tone(m.maeR)}
          hint={m.maeR == null ? "Not enriched" : undefined}
        />
        <Metric
          label="Capture"
          value={m.capture != null ? `${Math.round(m.capture * 100)}%` : "—"}
          hint={m.capture != null ? "Realized / MFE" : "Needs MFE"}
        />
        <Metric label="Hold" value={holdingLabel(m.holdSeconds)} />
      </div>

      <AnatomyChart
        model={model}
        progress={progress}
        activeId={activeId}
        onSelectPoint={onSelectPoint}
      />

      <div className="controls">
        <div className="buttons">
          <button
            type="button"
            onClick={() => {
              if (progress >= 1) setProgress(0);
              setPlaying((p) => !p);
            }}
            aria-pressed={playing}
          >
            {playing ? "Pause" : progress >= 1 ? "Replay" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setProgress(0);
              setActiveId("entry");
            }}
          >
            Reset
          </button>
        </div>
        <label className="scrub">
          <span className="sr">Timeline</span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(progress * 1000)}
            onChange={(e) => {
              setPlaying(false);
              const next = Number(e.target.value) / 1000;
              setProgress(next);
              const nearest = model.path.reduce((best, p) =>
                Math.abs(p.t - next) < Math.abs(best.t - next) ? p : best,
              );
              setActiveId(nearest.id);
            }}
            aria-valuetext={activePoint ? activePoint.label : undefined}
          />
        </label>
        {activePoint && (
          <p className="active-readout" aria-live="polite">
            <strong>{activePoint.label}</strong>
            <span className="num">{num(scrub.price ?? activePoint.price, 5)}</span>
            {activePoint.r != null && (
              <span className={`num ${tone(activePoint.r)}`}>{signed(activePoint.r, "R")}</span>
            )}
            {model.pathMode === "ohlc" && <span className="mode">M1 path</span>}
            {!activePoint.timed && activePoint.id !== "entry" && activePoint.id !== "exit" && (
              <span className="untimed">untimed marker</span>
            )}
          </p>
        )}
      </div>

      {!compact && <InsightCard insight={toInsight(model)} compact />}

      <style jsx>{`
        .trade-anatomy {
          display: grid;
          gap: 12px;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 10px 12px;
          padding: 10px 12px;
          border: 1px solid var(--line);
          background: var(--surface);
        }
        .controls {
          display: grid;
          gap: 8px;
        }
        .buttons {
          display: flex;
          gap: 8px;
        }
        .buttons button {
          padding: 7px 12px;
          border: 1px solid var(--line-strong);
          background: color-mix(in srgb, var(--accent) 10%, var(--surface));
          color: var(--text);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border-radius: var(--radius-sm, 6px);
        }
        .buttons button:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .scrub {
          display: grid;
          gap: 4px;
        }
        .scrub input {
          width: 100%;
          accent-color: var(--accent);
        }
        .sr {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
        }
        .active-readout {
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 8px 12px;
          align-items: baseline;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .active-readout strong {
          color: var(--text);
        }
        .untimed {
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .mode {
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--accent);
        }
        @media (max-width: 720px) {
          .metrics {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (max-width: 420px) {
          .metrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );
}
