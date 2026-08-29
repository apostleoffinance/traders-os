"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { holdingLabel, sessionLabel, tone } from "@/lib/format";
import type { TradeReplay, ReplayInsight } from "@/lib/trade-replay";

function insightIcon(tone: string): string {
  if (tone === "ok") return "✓";
  if (tone === "warn") return "⚠";
  if (tone === "bad") return "✕";
  return "·";
}

function PricePath({ replay }: { replay: TradeReplay }) {
  const { price_path: p, levels } = replay;
  const w = 280;
  const h = 200;
  const pad = 24;

  const y = (norm: number | null) => {
    if (norm === null) return null;
    return pad + (1 - norm) * (h - pad * 2);
  };

  const entryY = y(p.entry_y) ?? h / 2;
  const exitY = y(p.exit_y);
  const stopY = y(p.stop_y);
  const targetY = y(p.target_y);

  const pathEnd = exitY ?? (p.favorable === false ? (stopY ?? entryY + 40) : targetY ?? entryY - 40);
  const midX = w * 0.55;
  const path = `M ${pad} ${entryY} C ${midX} ${entryY}, ${midX} ${pathEnd}, ${w - pad} ${pathEnd}`;

  return (
    <div className="price-path">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Schematic price path from entry to exit">
        {stopY !== null && (
          <line x1={pad} y1={stopY} x2={w - pad} y2={stopY} className="level sl" />
        )}
        {targetY !== null && (
          <line x1={pad} y1={targetY} x2={w - pad} y2={targetY} className="level tp" />
        )}
        <line x1={pad} y1={entryY} x2={w - pad} y2={entryY} className="level entry" />
        {replay.status === "closed" && (
          <path d={path} className={`movement ${p.favorable ? "up" : "down"}`} fill="none" />
        )}
        <circle cx={pad} cy={entryY} r={5} className="dot entry" />
        {exitY !== null && <circle cx={w - pad} cy={exitY} r={5} className="dot exit" />}
      </svg>
      <div className="level-labels">
        <span>SL {levels.stop_loss}</span>
        <span>Entry {levels.entry}</span>
        {levels.take_profit && <span>TP {levels.take_profit}</span>}
        {levels.exit && <span>Exit {levels.exit}</span>}
      </div>
      <style jsx>{`
        .price-path {
          background: color-mix(in srgb, var(--surface) 92%, var(--bg));
          border: 1px solid var(--line);
          padding: 12px;
        }
        svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .level {
          stroke: var(--line-strong);
          stroke-width: 1;
          stroke-dasharray: 4 4;
        }
        .level.entry {
          stroke: var(--accent);
          stroke-dasharray: none;
          opacity: 0.5;
        }
        .level.sl {
          stroke: var(--danger, #ef4444);
        }
        .level.tp {
          stroke: var(--pos, #22c55e);
        }
        .movement {
          stroke-width: 2.5;
        }
        .movement.up {
          stroke: var(--pos, #22c55e);
        }
        .movement.down {
          stroke: var(--danger, #ef4444);
        }
        .dot.entry {
          fill: var(--accent);
        }
        .dot.exit {
          fill: ${p.favorable ? "var(--pos, #22c55e)" : "var(--danger, #ef4444)"};
        }
        .level-labels {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          margin-top: 8px;
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 11px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}

function Timeline({ events }: { events: TradeReplay["timeline"] }) {
  return (
    <ol className="timeline">
      {events.map((ev, i) => (
        <li key={`${ev.phase}-${i}`} className={ev.phase}>
          <div className="dot" />
          <div className="body">
            <div className="row">
              <strong>{ev.label}</strong>
              {ev.time_label && <time>{ev.time_label}</time>}
            </div>
            {ev.price && <span className="price num">{ev.price}</span>}
            {ev.duration_seconds != null && (
              <span className="muted">{holdingLabel(ev.duration_seconds)} in trade</span>
            )}
            {ev.detail && <span className="muted">{ev.detail}</span>}
          </div>
        </li>
      ))}
      <style jsx>{`
        .timeline {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0;
        }
        li {
          display: grid;
          grid-template-columns: 16px 1fr;
          gap: 10px;
          padding-bottom: 16px;
          position: relative;
        }
        li:not(:last-child)::before {
          content: "";
          position: absolute;
          left: 7px;
          top: 14px;
          bottom: 0;
          width: 2px;
          background: var(--line);
        }
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--accent);
          margin-top: 4px;
          border: 2px solid var(--surface);
          box-shadow: 0 0 0 1px var(--line-strong);
        }
        li.exit .dot {
          background: var(--pos, #22c55e);
        }
        li.open .dot {
          background: var(--warn, #f59e0b);
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        .row strong {
          font-size: 14px;
        }
        time {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .price {
          display: block;
          font-size: 13px;
          margin-top: 2px;
        }
        .muted {
          display: block;
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
        }
      `}</style>
    </ol>
  );
}

function ContextBlock({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div className="ctx-block">
      <h3>{title}</h3>
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd className="num">{item.value}</dd>
          </div>
        ))}
      </dl>
      <style jsx>{`
        .ctx-block {
          padding: 12px 14px;
          background: var(--surface);
          border: 1px solid var(--line);
        }
        h3 {
          margin: 0 0 10px;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
        }
        dl {
          margin: 0;
          display: grid;
          gap: 8px;
        }
        div {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        dt {
          font-size: 13px;
          color: var(--text-secondary);
        }
        dd {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

function InsightList({ title, insights }: { title: string; insights: ReplayInsight[] }) {
  if (insights.length === 0) return null;
  return (
    <div className="insight-panel">
      <h3>{title}</h3>
      <ul>
        {insights.map((ins, i) => (
          <li key={i} className={ins.tone}>
            <span className="icon">{insightIcon(ins.tone)}</span>
            <div>
              <p>{ins.text}</p>
              {ins.detail && <p className="detail">{ins.detail}</p>}
            </div>
          </li>
        ))}
      </ul>
      <style jsx>{`
        .insight-panel {
          padding: 14px 16px;
          background: color-mix(in srgb, var(--surface) 95%, var(--bg));
          border: 1px solid var(--line);
        }
        h3 {
          margin: 0 0 12px;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 10px;
        }
        li {
          display: grid;
          grid-template-columns: 20px 1fr;
          gap: 8px;
          align-items: start;
        }
        .icon {
          font-size: 14px;
          line-height: 1.4;
        }
        li.ok .icon {
          color: var(--pos, #22c55e);
        }
        li.warn .icon {
          color: var(--warn, #f59e0b);
        }
        li.bad .icon {
          color: var(--danger, #ef4444);
        }
        p {
          margin: 0;
          font-size: 14px;
          line-height: 1.45;
        }
        .detail {
          margin-top: 4px;
          font-size: 12px;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}

export function TradeReplayView({ tradeId }: { tradeId: string }) {
  const [replay, setReplay] = useState<TradeReplay | null>(null);
  const [showDecision, setShowDecision] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<TradeReplay>(`/api/trades/${tradeId}/replay`)
      .then(setReplay)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to load replay");
      });
  }, [tradeId]);

  if (error) return <p className="muted">{error}</p>;
  if (!replay) return <p className="muted">Loading trade replay…</p>;

  const dq = replay.decision_quality;
  const isClosed = replay.status === "closed";

  return (
    <section className="replay">
      <header className="replay-head">
        <div>
          <p className="kicker">Trade replay</p>
          <h2>
            {replay.symbol} {replay.direction.toUpperCase()}
          </h2>
          <p className="muted">
            {sessionLabel(replay.session)} · {replay.timeframe}
            {!isClosed && " · position open"}
          </p>
        </div>
        <div className="quality">
          <span className="kicker">Decision quality</span>
          <div className="quality-score num">{dq.process_score}</div>
          {isClosed && dq.outcome_r && (
            <div className={`outcome num ${tone(dq.outcome_r)}`}>{dq.outcome_r}R outcome</div>
          )}
          <p className="headline">{dq.headline}</p>
        </div>
      </header>

      <div className="replay-grid">
        <div className="visual">
          <PricePath replay={replay} />
          <Timeline events={replay.timeline} />
        </div>
        <div className="context">
          <ContextBlock title="Pre-trade" items={replay.context.pre_trade} />
          <ContextBlock title="Execution" items={replay.context.execution} />
          {isClosed && <ContextBlock title="Post-trade" items={replay.context.post_trade} />}
        </div>
      </div>

      <button type="button" className="replay-btn" onClick={() => setShowDecision((v) => !v)}>
        {showDecision ? "Hide decision replay" : "Replay my decision"}
      </button>

      {showDecision && (
        <div className="decision-grid">
          <InsightList title="What you knew at entry" insights={replay.decision_replay.at_entry} />
          {isClosed && (
            <InsightList title="What happened after" insights={replay.decision_replay.after} />
          )}
        </div>
      )}

      <style jsx>{`
        .replay {
          margin-bottom: 18px;
          padding: 16px 18px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .replay-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
          align-items: flex-start;
        }
        .kicker {
          margin: 0 0 4px;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-secondary);
          font-weight: 700;
        }
        h2 {
          margin: 0;
          font-size: 22px;
        }
        .muted {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--text-secondary);
        }
        .quality {
          text-align: right;
          max-width: 220px;
        }
        .quality-score {
          font-size: 32px;
          font-weight: 700;
          line-height: 1.1;
          color: var(--accent);
        }
        .outcome {
          font-size: 14px;
          margin-top: 2px;
        }
        .headline {
          margin: 6px 0 0;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        .replay-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 14px;
          margin-bottom: 14px;
        }
        .visual {
          display: grid;
          gap: 14px;
        }
        .context {
          display: grid;
          gap: 10px;
          align-content: start;
        }
        .replay-btn {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--line-strong);
          background: color-mix(in srgb, var(--accent) 12%, var(--surface));
          color: var(--text);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border-radius: var(--radius-sm);
        }
        .replay-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .decision-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        @media (max-width: 800px) {
          .replay-head,
          .replay-grid,
          .decision-grid {
            grid-template-columns: 1fr;
          }
          .quality {
            text-align: left;
            max-width: none;
          }
        }
      `}</style>
    </section>
  );
}
