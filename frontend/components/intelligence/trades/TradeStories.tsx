"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Trade } from "@/lib/types";
import type { TradeReplay } from "@/lib/trade-replay";
import { formatDate, signed, tone } from "@/lib/format";

const TradeAnatomy = dynamic(
  () =>
    import("@/components/visualizations/trade-anatomy").then((m) => m.TradeAnatomy),
  {
    ssr: false,
    loading: () => (
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Loading trade journey…
      </p>
    ),
  },
);

function capturePct(mfeR: string | null | undefined, realizedR: string | null | undefined): string | null {
  if (mfeR == null || realizedR == null) return null;
  const mfe = Number(mfeR);
  const r = Number(realizedR);
  if (!Number.isFinite(mfe) || !Number.isFinite(r) || mfe <= 0) return null;
  return `${Math.round((r / mfe) * 100)}%`;
}

function TradeStoryCard({
  trade,
  expanded,
  onToggle,
}: {
  trade: Trade;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [replay, setReplay] = useState<TradeReplay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api<TradeReplay>(`/api/trades/${trade.id}/replay`)
      .then((r) => {
        if (!cancelled) setReplay(r);
      })
      .catch(() => {
        if (!cancelled) {
          setReplay(null);
          setError("Trade journey unavailable for this trade.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, trade.id]);

  const r = trade.realized_r;
  const captured = capturePct(trade.mfe_r, trade.realized_r);
  const when = formatDate(trade.exit_timestamp ?? trade.trade_timestamp);

  return (
    <article className={`story ${expanded ? "open" : ""}`}>
      <button
        type="button"
        className="head"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`story-${trade.id}`}
      >
        <div className="id">
          <strong>
            {trade.symbol} {trade.direction.toUpperCase()}
          </strong>
          <span className="when">{when}</span>
        </div>
        <span className={`r ${tone(r)}`}>{r != null ? `${signed(r)}R` : "—"}</span>
      </button>

      <dl className="meta">
        <div>
          <dt>MFE</dt>
          <dd className="pos">{trade.mfe_r != null ? `${signed(trade.mfe_r)}R` : "—"}</dd>
        </div>
        <div>
          <dt>MAE</dt>
          <dd className="neg">{trade.mae_r != null ? `${signed(trade.mae_r)}R` : "—"}</dd>
        </div>
        <div>
          <dt>Captured</dt>
          <dd>{captured ?? "—"}</dd>
        </div>
        {trade.setup_name ? (
          <div>
            <dt>Setup</dt>
            <dd>{trade.setup_name}</dd>
          </div>
        ) : null}
      </dl>

      {expanded ? (
        <div id={`story-${trade.id}`} className="body">
          {loading ? <p className="hint">Loading journey…</p> : null}
          {error ? <p className="hint">{error}</p> : null}
          {replay ? (
            <TradeAnatomy
              replay={replay}
              compact
              fallbacks={{
                mfeR: trade.mfe_r,
                maeR: trade.mae_r,
                realizedR: trade.realized_r,
                holdSeconds: trade.holding_time_seconds,
              }}
            />
          ) : null}
          <Link href={`/trades/${trade.id}`} className="replay">
            Open trade →
          </Link>
        </div>
      ) : null}

      <style jsx>{`
        .story {
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          padding: 10px 12px;
          display: grid;
          gap: 8px;
        }
        .story.open {
          border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
        }
        .head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          width: 100%;
          border: none;
          background: transparent;
          padding: 0;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          color: inherit;
        }
        .head:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
          border-radius: 4px;
        }
        .id {
          display: grid;
          gap: 2px;
        }
        .id strong {
          font-size: 13px;
          font-weight: 650;
          color: var(--text-primary);
        }
        .when {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 600;
        }
        .r {
          font-size: 1.05rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
        }
        .r.pos {
          color: var(--pos);
        }
        .r.neg {
          color: var(--neg);
        }
        .meta {
          margin: 0;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .meta dt {
          margin: 0;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .meta dd {
          margin: 0;
          font-size: 12px;
          font-weight: 650;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .meta dd.pos {
          color: var(--pos);
        }
        .meta dd.neg {
          color: var(--neg);
        }
        .body {
          display: grid;
          gap: 10px;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }
        .hint {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .story :global(.replay) {
          font-size: 12px;
          font-weight: 650;
          color: var(--accent-text, var(--accent));
          text-decoration: none;
          width: fit-content;
        }
        .story :global(.replay:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        @media (max-width: 700px) {
          .meta {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </article>
  );
}

/**
 * Recent closed trades with on-demand Trade Anatomy — lazy, no fabricated journeys.
 */
export function TradeStories({
  accountId,
  limit = 4,
}: {
  accountId: string;
  limit?: number;
}) {
  const [trades, setTrades] = useState<Trade[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    void api<Trade[]>(`/api/trades?account_id=${accountId}`)
      .then((rows) => {
        if (!cancelled) setTrades(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setTrades([]);
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const recent = useMemo(() => {
    if (!trades) return [];
    return [...trades]
      .filter((t) => t.status === "closed")
      .sort(
        (a, b) =>
          Date.parse(b.exit_timestamp ?? b.trade_timestamp) -
          Date.parse(a.exit_timestamp ?? a.trade_timestamp),
      )
      .slice(0, limit);
  }, [trades, limit]);

  if (loadError) return null;
  if (trades == null) {
    return (
      <section className="stories" aria-busy="true" aria-labelledby="stories-title">
        <header className="head">
          <h2 id="stories-title">Recent trade stories</h2>
          <p className="sub">Loading recent closed trades…</p>
        </header>
        <style jsx>{`
          .stories {
            display: grid;
            gap: 10px;
          }
          .head {
            display: grid;
            gap: 2px;
          }
          h2 {
            margin: 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: var(--text-primary);
          }
          .sub {
            margin: 0;
            font-size: 12px;
            color: var(--text-muted);
          }
        `}</style>
      </section>
    );
  }
  if (!recent.length) return null;

  return (
    <section className="stories" aria-labelledby="stories-title">
      <header className="head">
        <h2 id="stories-title">Recent trade stories</h2>
        <p className="sub">
          {recent.length} recent closed trade{recent.length === 1 ? "" : "s"} · expand to replay the journey
        </p>
      </header>
      <div className="list">
        {recent.map((trade) => (
          <TradeStoryCard
            key={trade.id}
            trade={trade}
            expanded={expandedId === trade.id}
            onToggle={() => setExpandedId((id) => (id === trade.id ? null : trade.id))}
          />
        ))}
      </div>
      <style jsx>{`
        .stories {
          display: grid;
          gap: 10px;
        }
        .head {
          display: grid;
          gap: 2px;
        }
        h2 {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-primary);
        }
        .sub {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .list {
          display: grid;
          gap: 8px;
        }
      `}</style>
    </section>
  );
}
