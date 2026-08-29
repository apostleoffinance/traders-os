"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import type { AnalyticsDashboard, EdgeDetail } from "@/lib/analytics";
import { buildAnalyticsQuery, type FilterState } from "@/lib/analytics";
import { num, sessionLabel } from "@/lib/format";
import { Panel } from "@/components/ui";

type Props = {
  accountId: string;
  data: AnalyticsDashboard;
  filters: FilterState;
};

function cellToneClass(tone: string): string {
  if (tone === "positive") return "pos";
  if (tone === "negative") return "neg";
  if (tone === "mixed") return "mix";
  return "empty";
}

export function EdgeExplorer({ accountId, data, filters }: Props) {
  const matrix = data.edge_matrix;
  const [selected, setSelected] = useState<{ symbol: string; session: string } | null>(null);
  const [detail, setDetail] = useState<EdgeDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDetail = useCallback(
    async (symbol: string, session: string) => {
      setSelected({ symbol, session });
      setLoading(true);
      try {
        const q = buildAnalyticsQuery(accountId, filters);
        const row = await api<EdgeDetail>(
          `/api/analytics/edge-detail?${q}&symbol=${encodeURIComponent(symbol)}&session=${encodeURIComponent(session)}`,
        );
        setDetail(row);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    },
    [accountId, filters],
  );

  function cell(symbol: string, session: string) {
    return matrix.cells.find((c) => c.symbol === symbol && c.session === session);
  }

  return (
    <div className="edge">
      <Panel
        title="Edge matrix"
        right={<span className="muted">Instrument × session · {matrix.evidence.label} evidence</span>}
      >
        <p className="muted intro">Click any cell to compare this edge against the rest of your trading.</p>
        {matrix.symbols.length === 0 ? (
          <p className="muted">Log closed trades to discover where your edge lives.</p>
        ) : (
          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th />
                  {matrix.sessions.map((s) => (
                    <th key={s}>{sessionLabel(s)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.symbols.map((sym) => (
                  <tr key={sym}>
                    <th>{sym}</th>
                    {matrix.sessions.map((sess) => {
                      const c = cell(sym, sess);
                      const tone = c?.tone ?? "neutral";
                      const exp = c?.expectancy_r;
                      return (
                        <td key={sess}>
                          <button
                            type="button"
                            className={`cell ${cellToneClass(tone)} ${selected?.symbol === sym && selected?.session === sess ? "sel" : ""}`}
                            onClick={() => void loadDetail(sym, sess)}
                            disabled={!c || c.n === 0}
                          >
                            {c && c.n > 0 && exp ? (
                              <>
                                <span className="exp">{num(exp)}R</span>
                                <span className="n">n={c.n}</span>
                              </>
                            ) : (
                              <span className="dash">—</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {data.edge_combos.length > 0 && (
        <Panel title="Top combinations (n≥5)">
          <ul className="combos">
            {data.edge_combos.map((c) => (
              <li key={c.label}>
                <button type="button" onClick={() => void loadDetail(c.symbol, c.session)}>
                  <strong>{c.label}</strong>
                  <span>
                    {c.expectancy_r}R · {c.win_rate ? `${num(c.win_rate, 1)}%` : "—"} · n={c.n}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {(selected || detail) && (
        <Panel title={detail?.label ?? `${selected?.symbol} × ${sessionLabel(selected?.session ?? "")}`}>
          {loading && <p className="muted">Loading comparison…</p>}
          {detail && !loading && (
            <div className="compare">
              <table className="cmp">
                <thead>
                  <tr>
                    <th />
                    <th>This edge</th>
                    <th>Rest</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Trades</td>
                    <td>{detail.edge.n}</td>
                    <td>{detail.rest.n}</td>
                  </tr>
                  <tr>
                    <td>Win rate</td>
                    <td>{detail.edge.win_rate ? `${num(detail.edge.win_rate, 1)}%` : "—"}</td>
                    <td>{detail.rest.win_rate ? `${num(detail.rest.win_rate, 1)}%` : "—"}</td>
                  </tr>
                  <tr>
                    <td>Expectancy</td>
                    <td>{detail.edge.expectancy_r ? `${detail.edge.expectancy_r}R` : "—"}</td>
                    <td>{detail.rest.expectancy_r ? `${detail.rest.expectancy_r}R` : "—"}</td>
                  </tr>
                  <tr>
                    <td>Discipline</td>
                    <td>{detail.edge.discipline_avg ?? "—"}</td>
                    <td>{detail.rest.discipline_avg ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
              {detail.top_setup && (
                <p className="muted">Most common setup in this cell: <strong>{detail.top_setup}</strong></p>
              )}
              <p className="evidence">
                {detail.edge.evidence.label} evidence (n={detail.edge.evidence.n}) — {detail.edge.evidence.reason}
              </p>
            </div>
          )}
        </Panel>
      )}

      <style jsx>{`
        .intro {
          margin: 0 0 12px;
          font-size: 14px;
        }
        .matrix-wrap {
          overflow-x: auto;
        }
        .matrix {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .matrix th,
        .matrix td {
          padding: 6px;
          text-align: center;
        }
        .matrix th {
          font-size: 12px;
          color: var(--muted);
          text-transform: capitalize;
        }
        .cell {
          width: 100%;
          min-width: 72px;
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 8px 6px;
          background: var(--surface-2);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
          align-items: center;
        }
        .cell:disabled {
          opacity: 0.45;
          cursor: default;
        }
        .cell.pos {
          border-color: color-mix(in srgb, var(--accent) 55%, var(--line));
          background: color-mix(in srgb, var(--accent) 12%, var(--surface));
        }
        .cell.neg {
          border-color: color-mix(in srgb, var(--danger) 45%, var(--line));
          background: color-mix(in srgb, var(--danger) 10%, var(--surface));
        }
        .cell.mix {
          border-color: color-mix(in srgb, var(--warning) 45%, var(--line));
        }
        .cell.sel {
          outline: 2px solid var(--accent);
          outline-offset: 1px;
        }
        .exp {
          font-family: var(--font-mono), monospace;
          font-weight: 700;
        }
        .n {
          font-size: 11px;
          color: var(--muted);
        }
        .combos {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .combos li button {
          width: 100%;
          text-align: left;
          border: 0;
          border-bottom: 1px solid var(--line);
          background: transparent;
          padding: 10px 0;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: inherit;
        }
        .combos li button:hover strong {
          color: var(--accent);
        }
        .combos span {
          font-family: var(--font-mono), monospace;
          font-size: 13px;
          color: var(--muted);
        }
        .cmp {
          width: 100%;
          border-collapse: collapse;
        }
        .cmp td,
        .cmp th {
          padding: 8px 10px;
          border-bottom: 1px solid var(--line);
          text-align: left;
        }
        .cmp td:not(:first-child) {
          font-family: var(--font-mono), monospace;
        }
        .evidence {
          font-size: 13px;
          color: var(--muted);
          margin-top: 12px;
        }
      `}</style>
    </div>
  );
}
