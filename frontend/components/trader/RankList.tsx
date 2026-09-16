"use client";

import { ChartCard } from "@/components/trader/ChartCard";
import type { AnalyticsInsight } from "@/lib/analytics/types";
import { formatPct, formatR, formatSampleSize } from "@/lib/visualization";

export type RankListRow = {
  key: string;
  label: string;
  expectancy: number | null;
  winRate: number | null;
  trades: number;
  netPnl?: number;
};

type RankListProps = {
  title: string;
  rows: RankListRow[];
  limit?: number;
  /** When set, wraps rows in ChartCard with question + insight (Analytics / Overview). */
  question?: string;
  insight?: AnalyticsInsight | null;
  onSelect?: (row: RankListRow) => void;
  emptyMessage?: string;
  /** Compact DOM list without ChartCard chrome (Reports). */
  variant?: "card" | "plain";
};

/** Shared top-N expectancy ranking — DOM only, no chart library. */
export function RankList({
  title,
  rows,
  limit = 3,
  question,
  insight = null,
  onSelect,
  emptyMessage = "Not enough trades to rank yet.",
  variant,
}: RankListProps) {
  const mode = variant ?? (question != null ? "card" : "plain");
  const top = rows.filter((r) => r.trades > 0).slice(0, limit);

  const body =
    top.length === 0 ? (
      <p className="empty">{emptyMessage}</p>
    ) : mode === "card" ? (
      <ol className="ranks">
        {top.map((row, i) => (
          <li key={row.key}>
            <button type="button" className="row" onClick={() => onSelect?.(row)} disabled={!onSelect}>
              <span className="pos">{i + 1}</span>
              <span className="label">{row.label}</span>
              <span className={`exp ${(row.expectancy ?? 0) > 0 ? "pos" : (row.expectancy ?? 0) < 0 ? "neg" : ""}`}>
                {row.expectancy != null ? formatR(row.expectancy) : "—"}
              </span>
              <span className="meta">
                {row.winRate != null ? formatPct(row.winRate) : "—"} · {formatSampleSize(row.trades)}
              </span>
            </button>
          </li>
        ))}
      </ol>
    ) : (
      <ol className="plain">
        {top.map((r, i) => (
          <li key={r.key}>
            <span className="pos">{i + 1}</span>
            <div className="meta-plain">
              <strong>{r.label}</strong>
              <span className="stats">
                {r.expectancy != null ? formatR(r.expectancy) : "—"} ·{" "}
                {r.winRate != null ? formatPct(r.winRate) : "—"} WR · {formatSampleSize(r.trades)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    );

  const styles = (
    <style jsx>{`
      .empty {
        margin: 0;
        font-size: 13px;
        color: var(--text-muted);
      }
      .ranks {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 6px;
      }
      .row {
        width: 100%;
        display: grid;
        grid-template-columns: 22px 1fr auto;
        grid-template-rows: auto auto;
        column-gap: 10px;
        row-gap: 2px;
        align-items: baseline;
        text-align: left;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        padding: 10px 12px;
        cursor: pointer;
        color: inherit;
      }
      .row:disabled {
        cursor: default;
      }
      .row:not(:disabled):hover {
        border-color: var(--accent);
      }
      .pos {
        grid-row: 1 / span 2;
        align-self: center;
        font-size: 12px;
        font-weight: 700;
        color: var(--text-muted);
      }
      .label {
        font-size: 13px;
        font-weight: 600;
      }
      .exp {
        font-size: 13px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .exp.pos {
        color: var(--success);
      }
      .exp.neg {
        color: var(--danger);
      }
      .meta {
        grid-column: 2 / span 2;
        font-size: 11px;
        color: var(--text-muted);
      }
      .plain {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 8px;
      }
      .plain li {
        display: flex;
        gap: 10px;
        align-items: flex-start;
      }
      .plain .pos {
        grid-row: auto;
        flex: 0 0 22px;
        height: 22px;
        border-radius: 6px;
        display: grid;
        place-items: center;
        font-size: 11px;
        font-weight: 700;
        background: var(--surface-2);
        color: var(--text-muted);
      }
      .meta-plain {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .meta-plain strong {
        font-size: 13px;
      }
      .stats {
        font-size: 12px;
        color: var(--text-muted);
      }
      .rank-plain {
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 12px 14px;
        background: var(--surface);
      }
      .rank-plain-title {
        margin: 0 0 10px;
        font-size: 13px;
        font-weight: 600;
      }
    `}</style>
  );

  if (mode === "card") {
    return (
      <ChartCard title={title} question={question} tier="essential" insight={insight} interactive={Boolean(onSelect)}>
        {body}
        {styles}
      </ChartCard>
    );
  }

  return (
    <div className="rank-plain">
      <h3 className="rank-plain-title">{title}</h3>
      {body}
      {styles}
    </div>
  );
}

export function sortEdgeRows(
  rows: { key: string; n: number; expectancy_r: string | null; win_rate: string | null }[],
  labelFn?: (k: string) => string,
): RankListRow[] {
  return [...rows]
    .filter((r) => r.n > 0)
    .sort((a, b) => Number(b.expectancy_r ?? -999) - Number(a.expectancy_r ?? -999))
    .map((r) => ({
      key: r.key,
      label: labelFn ? labelFn(r.key) : r.key,
      expectancy: r.expectancy_r != null ? Number(r.expectancy_r) : null,
      winRate: r.win_rate != null ? Number(r.win_rate) : null,
      trades: r.n,
    }));
}
