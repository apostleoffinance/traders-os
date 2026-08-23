"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, fetchMediaBlob } from "@/lib/api";
import type { Trade } from "@/lib/types";
import { Badge, Panel } from "@/components/ui";
import { IntelligenceRunner } from "@/components/IntelligenceRunner";
import { formatWhen, holdingLabel, money, sessionLabel, signed, tone } from "@/lib/format";

function Shot({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchMediaBlob(url).then((u) => {
      if (alive) setSrc(u);
    });
    return () => {
      alive = false;
    };
  }, [url]);
  if (!src) return <p className="muted">{label}: loading…</p>;
  return (
    <figure>
      <figcaption className="muted">{label}</figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} />
      <style jsx>{`
        img {
          width: 100%;
          border: 1px solid var(--line);
        }
        figcaption {
          margin-bottom: 6px;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
      `}</style>
    </figure>
  );
}

export default function TradeDetailPage() {
  const params = useParams<{ id: string }>();
  const [trade, setTrade] = useState<Trade | null>(null);

  useEffect(() => {
    void api<Trade>(`/api/trades/${params.id}`).then(setTrade);
  }, [params.id]);

  if (!trade) return <p className="muted">Loading…</p>;

  return (
    <div>
      <div className="head">
        <div>
          <p className="page-kicker">{sessionLabel(trade.session)} · {trade.timeframe}</p>
          <h1>
            {trade.symbol} {trade.direction.toUpperCase()}
          </h1>
          <p className="muted">{formatWhen(trade.trade_timestamp, trade.timezone)}</p>
        </div>
        <div className="head-right">
          <Badge status={trade.result} />
          <div className={`num r ${tone(trade.realized_r)}`}>
            {trade.realized_r ? `${trade.realized_r}R` : "-"}
          </div>
          <div className={`num ${tone(trade.realized_pnl)}`}>{signed(trade.realized_pnl)}</div>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <IntelligenceRunner
          path={`/api/ai/trades/${trade.id}/review`}
          label="Analyze trade with AI"
          hint="Separates P/L from discipline. Historical comparables exclude later trades (no look-ahead)."
        />
        <IntelligenceRunner
          path={`/api/ai/trades/${trade.id}/challenge`}
          label="Challenge my thinking"
          hint="Questions assumptions. Never BUY / SELL / HOLD."
        />
      </div>
      <div className="cols">
        <Panel title="Setup">
          <table>
            <tbody>
              <tr>
                <td>Setup</td>
                <td>{trade.setup_name ?? "-"}</td>
              </tr>
              <tr>
                <td>Entry</td>
                <td className="num">{trade.entry_price}</td>
              </tr>
              <tr>
                <td>SL</td>
                <td className="num">{trade.stop_loss}</td>
              </tr>
              <tr>
                <td>TP</td>
                <td className="num">{trade.take_profit ?? "-"}</td>
              </tr>
              <tr>
                <td>Exit</td>
                <td className="num">{trade.exit_price ?? "-"}</td>
              </tr>
              <tr>
                <td>Lot</td>
                <td className="num">{trade.lot_size}</td>
              </tr>
              <tr>
                <td>Hold</td>
                <td>{holdingLabel(trade.holding_time_seconds)}</td>
              </tr>
            </tbody>
          </table>
        </Panel>
        <Panel title="Execution & risk">
          <table>
            <tbody>
              <tr>
                <td>Risk</td>
                <td className="num">{money(trade.risk_amount)}</td>
              </tr>
              <tr>
                <td>Planned R:R</td>
                <td className="num">{trade.planned_rr ?? "-"}</td>
              </tr>
              <tr>
                <td>Realized R</td>
                <td className={`num ${tone(trade.realized_r)}`}>{trade.realized_r ?? "-"}</td>
              </tr>
              <tr>
                <td>P/L</td>
                <td className={`num ${tone(trade.realized_pnl)}`}>{signed(trade.realized_pnl)}</td>
              </tr>
              <tr>
                <td>Discipline</td>
                <td className="num">{trade.discipline_score ?? "-"} / 100</td>
              </tr>
              <tr>
                <td>Setup valid</td>
                <td>{trade.setup_valid ? "Yes" : "No"}</td>
              </tr>
              <tr>
                <td>Rules followed</td>
                <td>{trade.rules_followed ? "Yes" : "No"}</td>
              </tr>
            </tbody>
          </table>
        </Panel>
      </div>
      {trade.screenshots.length > 0 && (
        <Panel title="Chart">
          <div className="shots">
            {trade.screenshots.map((s) => (
              <Shot key={s.id} url={s.url} label={s.type} />
            ))}
          </div>
        </Panel>
      )}
      <div className="cols">
        <Panel title="Psychology">
          {trade.psychology ? (
            <table>
              <tbody>
                <tr>
                  <td>Before</td>
                  <td>{trade.psychology.emotion_before}</td>
                </tr>
                <tr>
                  <td>During</td>
                  <td>{trade.psychology.emotion_during}</td>
                </tr>
                <tr>
                  <td>After</td>
                  <td>{trade.psychology.emotion_after}</td>
                </tr>
                <tr>
                  <td>FOMO / Fear / Revenge</td>
                  <td>
                    {trade.psychology.fomo} / {trade.psychology.fear} / {trade.psychology.revenge}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="muted">No psychology recorded.</p>
          )}
        </Panel>
        <Panel title="Process check">
          {trade.checklist.length === 0 ? (
            <p className="muted">No process check recorded.</p>
          ) : (
            <ul>
              {trade.checklist.map((c) => (
                <li key={c.item_id}>
                  {c.kind === "automatic" ? (c.checked ? "🟢" : "🔴") : c.checked ? "☑" : "☐"} {c.label ?? c.item_id}
                  {c.kind === "automatic" ? <span className="muted"> auto</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {trade.notes && (
        <Panel title="Notes">
          <p>{trade.notes}</p>
        </Panel>
      )}
      <style jsx>{`
        .head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
          gap: 16px;
        }
        .head-right {
          text-align: right;
          display: grid;
          justify-items: end;
          gap: 4px;
        }
        .r {
          font-size: 22px;
        }
        .cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        td {
          padding: 6px 0;
          border-bottom: 1px solid var(--line);
        }
        td:last-child {
          text-align: right;
        }
        .shots {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        @media (max-width: 800px) {
          .cols,
          .shots {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
