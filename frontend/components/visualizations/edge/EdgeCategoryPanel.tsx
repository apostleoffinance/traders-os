"use client";

import type { GroupPerformanceRow } from "@/lib/analytics/view-models";
import { formatPct, formatR, formatSampleSize, SAMPLE, expectancyTone } from "@/lib/visualization";

export type EdgeBarMode = "share" | "expectancy";

type EdgeCategoryPanelProps = {
  title: string;
  subtitle: string;
  entitySingular: string;
  entityPlural: string;
  rows: GroupPerformanceRow[];
  mode: EdgeBarMode;
  emptyHint: string;
  limit?: number;
  onSelect?: (row: GroupPerformanceRow) => void;
};

function barWidthPct(value: number, maxAbs: number): number {
  if (maxAbs <= 0 || !Number.isFinite(value)) return 0;
  return Math.max(4, Math.round((Math.abs(value) / maxAbs) * 100));
}

function sharePct(trades: number, total: number): number {
  if (total <= 0) return 0;
  return (trades / total) * 100;
}

/** One Edge Snapshot category — hero metrics, DOM bars, footer context. */
export function EdgeCategoryPanel({
  title,
  subtitle,
  entitySingular,
  entityPlural,
  rows,
  mode,
  emptyHint,
  limit = 5,
  onSelect,
}: EdgeCategoryPanelProps) {
  const top = rows.filter((r) => r.trades > 0).slice(0, limit);
  const totalTrades = rows.reduce((s, r) => s + r.trades, 0);
  const best = top[0] ?? null;
  const profitable = rows.filter((r) => (r.expectancy ?? 0) > 0).length;
  const topShare = best && totalTrades > 0 ? sharePct(best.trades, totalTrades) : 0;
  const maxAbsExp = Math.max(...top.map((r) => Math.abs(r.expectancy ?? 0)), 0.01);
  const maxTrades = Math.max(...top.map((r) => r.trades), 1);
  const earlyBest = best != null && best.trades < SAMPLE.minGroup;

  const insight =
    best == null
      ? null
      : earlyBest
        ? `Highest observed: ${best.label} — limited history (${formatSampleSize(best.trades)}).`
        : `Highest observed result: ${best.label}.`;

  return (
    <article className="panel" aria-label={title}>
      <header className="head">
        <h3 className="title">{title}</h3>
        <p className="subtitle">{subtitle}</p>
      </header>

      {top.length === 0 ? (
        <p className="empty">{emptyHint}</p>
      ) : (
        <>
          <div className="hero">
            <div className="hero-left">
              <span className="hero-num">{top.length}</span>
              <span className="hero-label">{top.length === 1 ? entitySingular : entityPlural}</span>
            </div>
            <div className="hero-right">
              <span className={`hero-r tone-${expectancyTone(best?.expectancy)}`}>
                {best?.expectancy != null ? formatR(best.expectancy) : "—"}
              </span>
              <span className="hero-label">highest observed</span>
            </div>
          </div>

          <ul className="rows" role="list">
            {top.map((row, i) => {
              const tone = expectancyTone(row.expectancy);
              const early = row.trades < SAMPLE.minGroup;
              const width =
                mode === "share"
                  ? barWidthPct(row.trades, maxTrades)
                  : barWidthPct(row.expectancy ?? 0, maxAbsExp);
              const secondary =
                mode === "share"
                  ? `${formatPct(sharePct(row.trades, totalTrades), 0)} of trades`
                  : row.winRate != null
                    ? `${formatPct(row.winRate)} win rate`
                    : null;

              return (
                <li key={row.key}>
                  <button
                    type="button"
                    className="row"
                    onClick={() => onSelect?.(row)}
                    disabled={!onSelect}
                    aria-label={`${row.label}, ${row.expectancy != null ? formatR(row.expectancy) : "no R"}, ${formatSampleSize(row.trades)}`}
                  >
                    <span className="rank" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="body">
                      <div className="line1">
                        <span className="name">{row.label}</span>
                        <span className={`result tone-${tone}`}>
                          {row.expectancy != null ? formatR(row.expectancy) : "—"}
                        </span>
                      </div>
                      <div className="bar-track" aria-hidden>
                        <span className={`bar fill-${tone === "neutral" ? "muted" : tone}`} style={{ width: `${width}%` }} />
                      </div>
                      <div className="line2">
                        <span>
                          {secondary ? `${secondary} · ` : null}
                          {formatSampleSize(row.trades)}
                        </span>
                        {early ? <span className="early">Early</span> : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {insight ? <p className="insight">{insight}</p> : null}

          <footer className="foot">
            <div>
              <strong>{formatSampleSize(totalTrades)}</strong>
              <span>in view</span>
            </div>
            <div>
              <strong>
                {mode === "share" ? formatPct(topShare, 0) : `${profitable}`}
              </strong>
              <span>{mode === "share" ? "top share" : "positive"}</span>
            </div>
            <div>
              <strong className={`tone-${expectancyTone(best?.expectancy)}`}>
                {best?.expectancy != null ? formatR(best.expectancy) : "—"}
              </strong>
              <span>best observed</span>
            </div>
          </footer>
        </>
      )}

      <style jsx>{`
        .panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
          padding: 14px 14px 12px;
          border: 1px solid var(--border);
          border-radius: var(--radius, 10px);
          background: var(--surface, var(--card));
        }
        .head {
          display: grid;
          gap: 2px;
        }
        .title {
          margin: 0;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        .subtitle {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.35;
        }
        .empty {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
          line-height: 1.45;
        }
        .hero {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-end;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--border);
        }
        .hero-left,
        .hero-right {
          display: grid;
          gap: 2px;
        }
        .hero-right {
          text-align: right;
        }
        .hero-num,
        .hero-r {
          font-size: 22px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1.1;
          color: var(--text-primary);
        }
        .hero-label {
          font-size: 11px;
          color: var(--text-muted);
        }
        .rows {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .row {
          width: 100%;
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          gap: 8px;
          align-items: start;
          text-align: left;
          border: 0;
          background: transparent;
          padding: 4px 2px;
          border-radius: 8px;
          cursor: pointer;
          color: inherit;
        }
        .row:disabled {
          cursor: default;
        }
        .row:not(:disabled):hover {
          background: color-mix(in srgb, var(--accent-soft, var(--surface-2)) 55%, transparent);
        }
        .row:not(:disabled):focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .rank {
          font-size: 11px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--text-muted);
          padding-top: 3px;
        }
        .body {
          min-width: 0;
          display: grid;
          gap: 4px;
        }
        .line1 {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: baseline;
        }
        .name {
          font-size: 13px;
          font-weight: 600;
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .result {
          flex-shrink: 0;
          font-size: 13px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .bar-track {
          height: 5px;
          border-radius: 999px;
          background: var(--surface-2, color-mix(in srgb, var(--border) 40%, transparent));
          overflow: hidden;
        }
        .bar {
          display: block;
          height: 100%;
          border-radius: 999px;
          max-width: 100%;
        }
        .fill-pos {
          background: var(--success, var(--pos));
          opacity: 0.75;
        }
        .fill-neg {
          background: var(--danger, var(--neg));
          opacity: 0.75;
        }
        .fill-muted {
          background: var(--text-muted);
          opacity: 0.35;
        }
        .line2 {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
          font-size: 11px;
          color: var(--text-muted);
        }
        .early {
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 1px 5px;
        }
        .insight {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .foot {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }
        .foot > div {
          display: grid;
          gap: 2px;
          min-width: 0;
        }
        .foot strong {
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--text-primary);
        }
        .foot span {
          font-size: 10px;
          color: var(--text-muted);
        }
        .tone-pos {
          color: var(--success, var(--pos));
        }
        .tone-neg {
          color: var(--danger, var(--neg));
        }
        .tone-neutral {
          color: var(--text-primary);
        }
      `}</style>
    </article>
  );
}
