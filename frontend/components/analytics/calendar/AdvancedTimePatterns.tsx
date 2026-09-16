"use client";

import type { CalendarViewModel } from "@/lib/analytics/calendarViewModel";
import { signed } from "@/lib/format";

/** Progressive disclosure for deeper temporal breakdowns. */
export function AdvancedTimePatterns({ model }: { model: CalendarViewModel }) {
  const { weekdayRhythm, sessionRhythm, monthlyCells, tradingDays, totalTrades, netR } = model;

  return (
    <details className="adv">
      <summary>Advanced time patterns</summary>
      <div className="body">
        <p className="intro">
          Deeper breakdowns from the same filtered trades — {totalTrades} trade
          {totalTrades === 1 ? "" : "s"} across {tradingDays} trading day
          {tradingDays === 1 ? "" : "s"}
          {netR != null ? ` · ${signed(netR)}R total` : ""}.
        </p>

        <div className="tables">
          <div>
            <h3>Weekday detail</h3>
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Trades</th>
                  <th>Avg R</th>
                  <th>Win %</th>
                </tr>
              </thead>
              <tbody>
                {weekdayRhythm.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No weekday data</td>
                  </tr>
                ) : (
                  weekdayRhythm.map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td>{r.n}</td>
                      <td>{r.avgR != null ? signed(r.avgR) : "—"}</td>
                      <td>{r.winRate != null ? `${Math.round(r.winRate)}%` : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {sessionRhythm.length > 0 ? (
            <div>
              <h3>Session detail</h3>
              <table>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Trades</th>
                    <th>Avg R</th>
                    <th>Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionRhythm.map((r) => (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td>{r.n}</td>
                      <td>{r.avgR != null ? signed(r.avgR) : "—"}</td>
                      <td>{r.winRate != null ? `${Math.round(r.winRate)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div>
            <h3>Month detail</h3>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Trades</th>
                  <th>Net R</th>
                  <th>Win %</th>
                </tr>
              </thead>
              <tbody>
                {[...monthlyCells]
                  .filter((c) => c.n > 0)
                  .sort((a, b) => b.key.localeCompare(a.key))
                  .map((c) => (
                    <tr key={c.key}>
                      <td>{c.key}</td>
                      <td>{c.n}</td>
                      <td>{c.r != null ? signed(c.r) : "—"}</td>
                      <td>{c.winRate != null ? `${Math.round(c.winRate)}%` : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <style jsx>{`
        .adv {
          padding: 12px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
        }
        summary {
          cursor: pointer;
          font-size: 12px;
          font-weight: 650;
          color: var(--text-secondary);
          list-style: none;
        }
        summary::-webkit-details-marker {
          display: none;
        }
        summary::before {
          content: "▸ ";
          color: var(--text-muted);
        }
        .adv[open] summary::before {
          content: "▾ ";
        }
        summary:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .body {
          margin-top: 12px;
          display: grid;
          gap: 14px;
        }
        .intro {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .tables {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        }
        h3 {
          margin: 0 0 6px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th,
        td {
          text-align: left;
          padding: 5px 6px;
          border-bottom: 1px solid var(--border);
          font-variant-numeric: tabular-nums;
        }
        th {
          color: var(--text-muted);
          font-weight: 650;
        }
      `}</style>
    </details>
  );
}
