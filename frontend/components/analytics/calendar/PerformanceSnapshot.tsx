"use client";

import type { CalendarViewModel } from "@/lib/analytics/calendarViewModel";
import { money, signed } from "@/lib/format";

function dayHint(day: { r: number | null; netPnl: number; n: number }, currency: string): string {
  const result = day.r != null ? `${signed(day.r)}R` : money(day.netPnl, currency);
  return `${result} · ${day.n} trade${day.n === 1 ? "" : "s"}`;
}

/** Compact temporal snapshot — four answers, no academic sample jargon. */
export function PerformanceSnapshot({
  model,
  currency,
  onOpenDay,
}: {
  model: CalendarViewModel;
  currency: string;
  onOpenDay?: (date: string) => void;
}) {
  const { bestDay, worstDay, bestWeekday, tradingDays, profitableDays, losingDays, earlyNote } = model;

  return (
    <section className="snap" aria-labelledby="snap-title">
      <h2 id="snap-title" className="sr">
        Performance snapshot
      </h2>
      <div className="grid">
        <button
          type="button"
          className={`card ${bestDay && onOpenDay ? "clickable" : ""}`}
          disabled={!bestDay || !onOpenDay}
          onClick={() => bestDay && onOpenDay?.(bestDay.date)}
        >
          <span className="label">Best day</span>
          <span className="value pos">{bestDay?.label ?? "—"}</span>
          <span className="hint">{bestDay ? dayHint(bestDay, currency) : "No trading days yet"}</span>
        </button>
        <button
          type="button"
          className={`card ${worstDay && onOpenDay ? "clickable" : ""}`}
          disabled={!worstDay || !onOpenDay}
          onClick={() => worstDay && onOpenDay?.(worstDay.date)}
        >
          <span className="label">Toughest day</span>
          <span className="value neg">{worstDay?.label ?? "—"}</span>
          <span className="hint">{worstDay ? dayHint(worstDay, currency) : "—"}</span>
        </button>
        <div className="card">
          <span className="label">Best weekday</span>
          <span className="value">{bestWeekday?.label ?? "—"}</span>
          <span className="hint">
            {bestWeekday
              ? `${bestWeekday.avgR != null ? `${signed(bestWeekday.avgR)}R avg` : "—"} · ${bestWeekday.n} trade${bestWeekday.n === 1 ? "" : "s"}`
              : "—"}
          </span>
        </div>
        <div className="card">
          <span className="label">Trading days</span>
          <span className="value">{tradingDays}</span>
          <span className="hint">
            {tradingDays ? `${profitableDays} profitable · ${losingDays} losing` : "—"}
          </span>
        </div>
      </div>
      {earlyNote ? (
        <p className="early" role="status">
          {earlyNote}
        </p>
      ) : null}
      <style jsx>{`
        .snap {
          display: grid;
          gap: 10px;
        }
        .sr {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        .card {
          display: grid;
          gap: 4px;
          text-align: left;
          padding: 12px 12px 10px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          color: inherit;
          font: inherit;
          min-width: 0;
        }
        .card.clickable {
          cursor: pointer;
        }
        .card.clickable:hover {
          border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
        }
        .card.clickable:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .card:disabled {
          cursor: default;
          opacity: 1;
        }
        .label {
          font-size: 11px;
          font-weight: 650;
          color: var(--text-muted);
        }
        .value {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }
        .value.pos {
          color: var(--pos);
        }
        .value.neg {
          color: var(--neg);
        }
        .hint {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          font-variant-numeric: tabular-nums;
        }
        .early {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
          max-width: 62ch;
        }
        @media (max-width: 900px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 480px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
