"use client";

import type { RhythmRow } from "@/lib/analytics/calendarViewModel";
import { signed } from "@/lib/format";

function RhythmList({
  title,
  rows,
  emptyHint,
}: {
  title: string;
  rows: RhythmRow[];
  emptyHint: string;
}) {
  if (!rows.length) {
    return (
      <div className="block">
        <h3>{title}</h3>
        <p className="empty">{emptyHint}</p>
        <style jsx>{`
          .block {
            display: grid;
            gap: 10px;
          }
          h3 {
            margin: 0;
            font-size: 12px;
            font-weight: 650;
            color: var(--text-secondary);
          }
          .empty {
            margin: 0;
            font-size: 13px;
            color: var(--text-muted);
          }
        `}</style>
      </div>
    );
  }

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.avgR ?? 0)), 0.01);

  return (
    <div className="block">
      <h3>{title}</h3>
      <ul className="list">
        {rows.map((row) => {
          const width =
            row.avgR == null ? 0 : Math.max(8, Math.round((Math.abs(row.avgR) / maxAbs) * 100));
          const toneCls = row.avgR == null ? "flat" : row.avgR > 0 ? "pos" : row.avgR < 0 ? "neg" : "flat";
          return (
            <li key={row.key} className="row">
              <div className="meta">
                <span className="name">{row.label}</span>
                <span className={`val ${toneCls}`}>
                  {row.avgR != null ? `${signed(row.avgR)}R avg` : "—"}
                  <span className="n">
                    {" "}
                    · {row.n} trade{row.n === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
              <div
                className="track"
                role="img"
                aria-label={`${row.label}: ${row.avgR != null ? signed(row.avgR) + "R" : "no average"}`}
              >
                <div className={`fill ${toneCls}`} style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <style jsx>{`
        .block {
          display: grid;
          gap: 10px;
        }
        h3 {
          margin: 0;
          font-size: 12px;
          font-weight: 650;
          color: var(--text-secondary);
        }
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 10px;
        }
        .row {
          display: grid;
          gap: 5px;
        }
        .meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: baseline;
        }
        .name {
          font-size: 13px;
          font-weight: 650;
          color: var(--text-primary);
        }
        .val {
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
        }
        .val.pos {
          color: var(--pos);
        }
        .val.neg {
          color: var(--neg);
        }
        .val.flat {
          color: var(--text-muted);
        }
        .n {
          font-weight: 600;
          color: var(--text-muted);
          font-family: inherit;
        }
        .track {
          height: 8px;
          border-radius: 4px;
          background: var(--surface-2);
          overflow: hidden;
        }
        .fill {
          height: 100%;
          border-radius: inherit;
          background: var(--accent);
          min-width: 2px;
        }
        .fill.pos {
          background: var(--pos);
        }
        .fill.neg {
          background: var(--neg);
        }
        .fill.flat {
          background: var(--text-muted);
          opacity: 0.4;
        }
      `}</style>
    </div>
  );
}

/** Compact weekday (+ optional session) rhythm — not a giant bar chart. */
export function TradingRhythm({
  weekday,
  session,
}: {
  weekday: RhythmRow[];
  session: RhythmRow[];
}) {
  const dual = session.length > 0;

  return (
    <section className="rhythm" aria-labelledby="rhythm-title">
      <header>
        <h2 id="rhythm-title">Trading rhythm</h2>
        <p className="sub">When do you tend to perform better?</p>
      </header>
      <div className={`cols ${dual ? "dual" : ""}`}>
        <RhythmList title="Weekday" rows={weekday} emptyHint="No weekday trades in this filter yet." />
        {dual ? <RhythmList title="Session" rows={session} emptyHint="No session data yet." /> : null}
      </div>
      <style jsx>{`
        .rhythm {
          display: grid;
          gap: 12px;
          padding: 14px 16px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
        }
        h2 {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--text-primary);
        }
        .sub {
          margin: 4px 0 0;
          font-size: 13px;
          color: var(--text-muted);
        }
        .cols {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }
        .cols.dual {
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 800px) {
          .cols.dual {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
