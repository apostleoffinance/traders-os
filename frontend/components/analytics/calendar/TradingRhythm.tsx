"use client";

import { useMemo, useState } from "react";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import type { RhythmRow } from "@/lib/analytics/calendarViewModel";
import { money, signed } from "@/lib/format";

const ALL_WEEKDAYS: Array<{ key: string; label: string }> = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

function toneOf(avgR: number | null): "pos" | "neg" | "flat" {
  if (avgR == null || avgR === 0) return "flat";
  return avgR > 0 ? "pos" : "neg";
}

function buildInsight(weekday: RhythmRow[], session: RhythmRow[]): string | null {
  const candidates = [...weekday, ...session].filter((r) => r.n > 0 && r.avgR != null);
  if (!candidates.length) return null;
  const best = [...candidates].sort((a, b) => (b.avgR ?? -Infinity) - (a.avgR ?? -Infinity))[0];
  if (!best || best.avgR == null) return null;
  const trades = `${best.n} trade${best.n === 1 ? "" : "s"}`;
  if (best.n < 5) {
    return `${best.label} is currently your strongest result, based on ${trades} (${signed(best.avgR)}R avg).`;
  }
  return `${best.label} is currently your strongest trading window (${signed(best.avgR)}R avg across ${trades}).`;
}

function normalizeWeekdayKey(key: string): string {
  const k = key.toLowerCase();
  if (ALL_WEEKDAYS.some((d) => d.key === k)) return k;
  const short: Record<string, string> = {
    mon: "monday",
    tue: "tuesday",
    wed: "wednesday",
    thu: "thursday",
    fri: "friday",
    sat: "saturday",
    sun: "sunday",
  };
  return short[k.slice(0, 3)] ?? k;
}

function RhythmRowButton({
  row,
  maxAbs,
  currency,
  kind,
  inactive,
  onSelect,
}: {
  row: RhythmRow;
  maxAbs: number;
  currency: string;
  kind: "weekday" | "session";
  inactive?: boolean;
  onSelect: () => void;
}) {
  const tone = inactive ? "flat" : toneOf(row.avgR);
  const width =
    inactive || row.avgR == null || row.n === 0
      ? 0
      : Math.max(10, Math.round((Math.abs(row.avgR) / maxAbs) * 100));
  const win =
    row.winRate != null && Number.isFinite(row.winRate) ? `${Math.round(row.winRate)}% win rate` : null;

  return (
    <button
      type="button"
      className={`row ${tone}${inactive ? " inactive" : ""}`}
      onClick={onSelect}
      disabled={inactive || row.n === 0}
      aria-label={`${kind === "weekday" ? "Weekday" : "Session"} ${row.label}: ${
        row.avgR != null ? `${signed(row.avgR)}R average` : "no average"
      }, ${row.n} trades`}
    >
      {!inactive && row.n > 0 ? (
        <span className="tip" role="tooltip">
          <strong>{row.label}</strong>
          <span>
            {row.n} trade{row.n === 1 ? "" : "s"}
          </span>
          {win ? <span>{win}</span> : null}
          {row.netPnl != null ? <span>{money(row.netPnl, currency)}</span> : null}
          {row.avgR != null ? <span>{signed(row.avgR)}R avg</span> : null}
        </span>
      ) : null}
      <div className="meta">
        <span className="name">{row.label}</span>
        <span className={`val ${tone}`}>
          {inactive || row.n === 0
            ? "—"
            : row.avgR != null
              ? `${signed(row.avgR)}R avg`
              : "—"}
          {!inactive && row.n > 0 ? (
            <span className="n">
              {" "}
              · {row.n} trade{row.n === 1 ? "" : "s"}
              {row.winRate != null ? ` · ${Math.round(row.winRate)}%` : ""}
            </span>
          ) : null}
        </span>
      </div>
      <div className="track" aria-hidden>
        <div className={`fill ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <style jsx>{`
        .row {
          position: relative;
          display: grid;
          gap: 5px;
          width: 100%;
          margin: 0;
          padding: 8px 10px;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          text-align: left;
          cursor: pointer;
          color: inherit;
          transition: background 0.12s ease, border-color 0.12s ease;
        }
        .row:hover:not(:disabled),
        .row:focus-visible {
          background: var(--surface-2);
          border-color: var(--border);
          outline: none;
          z-index: 2;
        }
        .row:disabled {
          cursor: default;
        }
        .row.inactive {
          opacity: 0.45;
        }
        .tip {
          display: none;
          position: absolute;
          left: 10px;
          bottom: calc(100% + 6px);
          z-index: 5;
          min-width: 140px;
          padding: 8px 10px;
          border-radius: 8px;
          border: 1px solid var(--border);
          background: var(--surface);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
          color: var(--text-secondary);
          font-size: 12px;
          line-height: 1.35;
          pointer-events: none;
        }
        .tip strong {
          display: block;
          margin-bottom: 4px;
          color: var(--text-primary);
          font-size: 12px;
        }
        .tip span {
          display: block;
        }
        .row:hover:not(:disabled) .tip,
        .row:focus-visible .tip {
          display: grid;
          gap: 2px;
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
          white-space: nowrap;
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
          height: 7px;
          border-radius: 4px;
          background: var(--surface-2);
          overflow: hidden;
        }
        .fill {
          height: 100%;
          border-radius: inherit;
          min-width: 0;
        }
        .fill.pos {
          background: var(--pos);
        }
        .fill.neg {
          background: var(--neg);
        }
        .fill.flat {
          background: var(--text-muted);
          opacity: 0.35;
        }
      `}</style>
    </button>
  );
}

function RhythmColumn({
  title,
  rows,
  maxAbs,
  currency,
  kind,
  emptyHint,
  onSelect,
}: {
  title: string;
  rows: RhythmRow[];
  maxAbs: number;
  currency: string;
  kind: "weekday" | "session";
  emptyHint: string;
  onSelect: (row: RhythmRow) => void;
}) {
  if (!rows.length) {
    return (
      <div className="block">
        <h3>{title}</h3>
        <p className="empty">{emptyHint}</p>
        <style jsx>{`
          .block {
            display: grid;
            gap: 8px;
            min-width: 0;
          }
          h3 {
            margin: 0;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
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

  return (
    <div className="block">
      <h3>{title}</h3>
      <ul className="list">
        {rows.map((row) => (
          <li key={row.key}>
            <RhythmRowButton
              row={row}
              maxAbs={maxAbs}
              currency={currency}
              kind={kind}
              inactive={row.n === 0}
              onSelect={() => onSelect(row)}
            />
          </li>
        ))}
      </ul>
      <style jsx>{`
        .block {
          display: grid;
          gap: 6px;
          min-width: 0;
          align-content: start;
        }
        h3 {
          margin: 0 0 2px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 2px;
        }
      `}</style>
    </div>
  );
}

/** Compact weekday + session rhythm — visual pattern first, then drilldown. */
export function TradingRhythm({
  weekday,
  session,
  currency = "USD",
  earlyNote = null,
}: {
  weekday: RhythmRow[];
  session: RhythmRow[];
  currency?: string;
  earlyNote?: string | null;
}) {
  const drill = useOptionalAnalyticsDrilldown();
  const [showAllDays, setShowAllDays] = useState(false);

  const activeWeekdays = useMemo(() => weekday.filter((r) => r.n > 0), [weekday]);
  const weekdayRows = useMemo(() => {
    if (!showAllDays) return activeWeekdays;
    const byKey = new Map(weekday.map((r) => [normalizeWeekdayKey(r.key), r]));
    return ALL_WEEKDAYS.map((d) => {
      const existing = byKey.get(d.key);
      if (existing) return { ...existing, key: d.key, label: d.label };
      return {
        key: d.key,
        label: d.label,
        n: 0,
        avgR: null,
        winRate: null,
        netPnl: null,
      } satisfies RhythmRow;
    });
  }, [showAllDays, weekday, activeWeekdays]);

  const sessionRows = useMemo(() => session.filter((r) => r.n > 0), [session]);

  const maxAbs = useMemo(() => {
    const vals = [...activeWeekdays, ...sessionRows]
      .map((r) => Math.abs(r.avgR ?? 0))
      .filter((v) => v > 0);
    return Math.max(...vals, 0.01);
  }, [activeWeekdays, sessionRows]);

  const insight = useMemo(
    () => buildInsight(activeWeekdays, sessionRows),
    [activeWeekdays, sessionRows],
  );

  const onSelect = (row: RhythmRow, kind: "weekday" | "session") => {
    if (!drill || row.n <= 0) return;
    if (kind === "session") {
      drill.applyPatch({ session: row.key }, row.label);
      drill.openTrades(`Session · ${row.label}`);
      return;
    }
    // No weekday filter in analytics — open current selection with a clear label.
    drill.openTrades(`Weekday · ${row.label}`);
  };

  const dual = sessionRows.length > 0 || activeWeekdays.length > 0;
  const hasInactiveWeekdays = activeWeekdays.length < 7;

  return (
    <section className="rhythm" aria-labelledby="rhythm-title">
      <header className="head">
        <div>
          <h2 id="rhythm-title">Trading rhythm</h2>
          <p className="sub">When do you tend to perform better?</p>
        </div>
        {hasInactiveWeekdays ? (
          <button
            type="button"
            className="toggle"
            onClick={() => setShowAllDays((v) => !v)}
            aria-pressed={showAllDays}
          >
            {showAllDays ? "Active days only" : "Show all days"}
          </button>
        ) : null}
      </header>

      {earlyNote ? <p className="note">{earlyNote}</p> : null}
      {insight ? <p className="insight">{insight}</p> : null}

      <div className={`cols ${dual ? "dual" : ""}`}>
        <RhythmColumn
          title="Weekday"
          rows={weekdayRows}
          maxAbs={maxAbs}
          currency={currency}
          kind="weekday"
          emptyHint="No weekday trades in this filter yet."
          onSelect={(row) => onSelect(row, "weekday")}
        />
        <RhythmColumn
          title="Session"
          rows={sessionRows}
          maxAbs={maxAbs}
          currency={currency}
          kind="session"
          emptyHint="No session data yet."
          onSelect={(row) => onSelect(row, "session")}
        />
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
        .head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
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
        .toggle {
          margin: 0;
          padding: 4px 8px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface-2);
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 650;
          cursor: pointer;
        }
        .toggle:hover,
        .toggle:focus-visible {
          color: var(--text-primary);
          outline: none;
        }
        .note,
        .insight {
          margin: 0;
          font-size: 13px;
          line-height: 1.4;
          color: var(--text-secondary);
        }
        .insight {
          padding: 8px 10px;
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--text-primary);
          font-weight: 550;
        }
        .cols {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        .cols.dual {
          grid-template-columns: 1fr 1fr;
          gap: 20px;
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
