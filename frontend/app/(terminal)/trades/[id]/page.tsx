"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, consumeUploadWarning, fetchMediaBlob } from "@/lib/api";
import type { Screenshot, Trade } from "@/lib/types";
import { Alert, Badge, Panel } from "@/components/ui";
import { IntelligenceRunner } from "@/components/IntelligenceRunner";
import { formatWhen, holdingLabel, money, sessionLabel, signed, tone } from "@/lib/format";

function Shot({
  url,
  label,
  editHref,
  onMissing,
}: {
  url: string;
  label: string;
  editHref: string;
  onMissing?: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setSrc(null);
    setError(null);
    void fetchMediaBlob(url)
      .then((u) => {
        if (!alive) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setSrc(u);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        const missing = err instanceof Error && (err as Error & { code?: string }).code === "media_missing";
        if (missing) {
          setError(err instanceof Error ? err.message : "Image file is missing. Re-upload from Edit trade.");
          onMissing?.();
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load image");
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, retry]);

  if (error) {
    return (
      <figure className="shot-slot">
        <figcaption className="muted">{label}</figcaption>
        <div className="shot-empty">
          <p className="muted">{error}</p>
          <div className="shot-actions">
            <button type="button" className="btn ghost" onClick={() => setRetry((n) => n + 1)}>
              Retry
            </button>
            <Link href={editHref} className="btn ghost">
              Re-upload
            </Link>
          </div>
        </div>
      </figure>
    );
  }

  if (!src) {
    return (
      <figure className="shot-slot">
        <figcaption className="muted">{label}</figcaption>
        <div className="shot-empty">
          <p className="muted">Loading…</p>
        </div>
      </figure>
    );
  }

  return (
    <figure className="shot-slot">
      <figcaption className="muted">{label}</figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} />
    </figure>
  );
}

function latestShot(shots: Screenshot[], type: string): Screenshot | undefined {
  return shots
    .filter((s) => s.type === type)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
}

function ChartSlot({
  label,
  shot,
  emptyCopy,
  actionHref,
  actionLabel,
  editHref,
  onMissing,
}: {
  label: string;
  shot: Screenshot | undefined;
  emptyCopy: string;
  actionHref: string;
  actionLabel: string;
  editHref: string;
  onMissing?: () => void;
}) {
  if (shot) {
    return <Shot url={shot.url} label={label} editHref={editHref} onMissing={onMissing} />;
  }
  return (
    <figure className="shot-slot">
      <figcaption className="muted">{label}</figcaption>
      <div className="shot-empty">
        <p className="muted">{emptyCopy}</p>
        <Link href={actionHref} className="btn ghost">
          {actionLabel}
        </Link>
      </div>
    </figure>
  );
}

export default function TradeDetailPage() {
  const params = useParams<{ id: string }>();
  const [trade, setTrade] = useState<Trade | null>(null);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);

  const reload = useCallback(() => {
    void api<Trade>(`/api/trades/${params.id}`).then(setTrade);
  }, [params.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const warning = consumeUploadWarning();
    if (warning) setUploadWarning(warning);
  }, []);

  if (!trade) return <p className="muted">Loading…</p>;

  const isOpen = trade.status === "open";
  const editHref = `/trades/${trade.id}/edit`;

  return (
    <div>
      {uploadWarning && <Alert kind="warn">{uploadWarning}</Alert>}
      <div className="head">
        <div>
          <p className="page-kicker">{sessionLabel(trade.session)} · {trade.timeframe}</p>
          <h1>
            {trade.symbol} {trade.direction.toUpperCase()}
          </h1>
          <p className="muted">
            {trade.lot_size} lot · {formatWhen(trade.trade_timestamp, trade.timezone)}
          </p>
          <div className="status-row">
            {isOpen ? <span className="open-pill">TRADE OPEN</span> : <Badge status="closed" />}
            {!isOpen && <Badge status={trade.result} />}
          </div>
        </div>
        <div className="head-right">
          {!isOpen && (
            <>
              <div className={`num r ${tone(trade.realized_r)}`}>
                {trade.realized_r ? `${trade.realized_r}R` : "-"}
              </div>
              <div className={`num ${tone(trade.realized_pnl)}`}>{signed(trade.realized_pnl)}</div>
            </>
          )}
          {isOpen && <p className="muted open-copy">Position is still running. Close it when you exit.</p>}
          <div className="actions">
            <Link href={`/trades/${trade.id}/edit`} className="btn">
              Edit trade
            </Link>
            {isOpen && (
              <Link href={`/trades/${trade.id}/close`} className="btn primary">
                Close trade
              </Link>
            )}
          </div>
        </div>
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
                <td className={`num ${tone(trade.realized_r)}`}>
                  {isOpen ? "—" : (trade.realized_r ?? "-")}
                </td>
              </tr>
              <tr>
                <td>P/L</td>
                <td className={`num ${tone(trade.realized_pnl)}`}>
                  {isOpen ? "—" : signed(trade.realized_pnl)}
                </td>
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

      {!isOpen && (
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
      )}

      <Panel title="Charts">
        <div className="shots">
          <ChartSlot
            label="Entry chart"
            shot={latestShot(trade.screenshots, "entry")}
            emptyCopy="No entry screenshot yet."
            actionHref={editHref}
            actionLabel="Add on Edit trade"
            editHref={editHref}
            onMissing={reload}
          />
          <ChartSlot
            label="Exit chart"
            shot={latestShot(trade.screenshots, "exit")}
            emptyCopy={
              isOpen
                ? "Available after you close the trade."
                : "No exit screenshot yet."
            }
            actionHref={isOpen ? `/trades/${trade.id}/close` : editHref}
            actionLabel={isOpen ? "Close trade" : "Add on Edit trade"}
            editHref={editHref}
            onMissing={reload}
          />
        </div>
      </Panel>
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
                  {c.kind === "automatic" ? (c.checked ? "🟢" : "🔴") : c.checked ? "☑" : "☐"}{" "}
                  {c.label ?? c.item_id}
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
          gap: 8px;
        }
        .status-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 8px;
        }
        .open-pill {
          display: inline-block;
          font-family: var(--font-mono), "IBM Plex Mono", ui-monospace, Menlo, monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          padding: 5px 10px;
          background: color-mix(in srgb, var(--accent) 18%, var(--surface));
          color: var(--accent);
        }
        .open-copy {
          max-width: 220px;
          margin: 0;
          font-size: 13px;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .actions :global(.btn) {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          border: 1px solid var(--line-strong);
          background: var(--surface);
          color: var(--text);
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
        }
        .actions :global(.btn.primary) {
          background: var(--accent);
          color: var(--accent-contrast);
          border-color: var(--accent);
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
        .shots :global(.shot-slot) {
          margin: 0;
        }
        .shots :global(figcaption) {
          margin-bottom: 6px;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .shots :global(img) {
          display: block;
          width: 100%;
          border: 1px solid var(--line);
        }
        .shots :global(.shot-empty) {
          display: grid;
          gap: 10px;
          align-content: center;
          justify-items: start;
          min-height: 160px;
          padding: 14px;
          border: 1px dashed var(--line-strong);
          background: color-mix(in srgb, var(--surface) 88%, var(--bg));
        }
        .shots :global(.shot-empty p) {
          margin: 0;
          font-size: 13px;
        }
        .shots :global(.shot-actions) {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .shots :global(.btn.ghost) {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border: 1px solid var(--line-strong);
          background: transparent;
          color: var(--text);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
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
          .head {
            flex-direction: column;
          }
          .head-right {
            text-align: left;
            justify-items: start;
          }
          .actions {
            justify-content: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
