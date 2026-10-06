"use client";

import { useState } from "react";
import { Alert, Button, Panel } from "@/components/ui";
import { api } from "@/lib/api";
import { formatWhen } from "@/lib/format";

type LifecycleEvent = {
  event_type: "source_deal" | "snapshot_position_observation" | string;
  occurred_at: string | null;
  received_at: string | null;
  external_deal_id?: string;
  source_deal_row_id?: string;
  entry_type?: string;
  direction?: string;
  symbol_raw?: string;
  volume?: string;
  price?: string;
  profit?: string;
  commission?: string;
  swap?: string;
  snapshot_id?: string;
  state?: "present" | "absent";
  position?: Record<string, unknown>;
  evidence?: string;
};

type LifecyclePosition = {
  external_position_id: string;
  canonical_trade: {
    trade_id: string;
    status: string;
    symbol: string | null;
    opened_at: string | null;
    closed_at: string | null;
    lot_size: string | null;
    realized_pnl: string | null;
  } | null;
  events: LifecycleEvent[];
};

type LifecycleResponse = {
  connection_id: string;
  account_id: string;
  generated_at: string;
  position_filter: string | null;
  coverage: {
    source_deal_rows: number;
    snapshots_scanned: number;
    snapshot_scan_limit: number;
    snapshot_history_complete: boolean;
    caveat: string;
  };
  positions: LifecyclePosition[];
};

export function Mt5PositionLifecyclePanel({ connectionId }: { connectionId: string }) {
  const [report, setReport] = useState<LifecycleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTimeline() {
    setLoading(true);
    setError(null);
    try {
      setReport(await api<LifecycleResponse>(
        `/api/integrations/mt5/connections/${connectionId}/lifecycle`,
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load position lifecycle evidence");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Panel
      title="Position lifecycle evidence"
      right={
        <Button type="button" kind="ghost" disabled={loading} onClick={() => void loadTimeline()}>
          {loading ? "Loading…" : report ? "Refresh timeline" : "Load timeline"}
        </Button>
      }
    >
      <p className="muted">
        Trace broker deals and observed position state over time. An absent snapshot observation is
        not treated as a confirmed close, and this view never edits trades or recalculates P&amp;L.
      </p>
      {error && <Alert kind="danger">{error}</Alert>}
      {report && (
        <>
          <div className="coverage">
            <span>{report.coverage.source_deal_rows} retained source deals</span>
            <span>{report.coverage.snapshots_scanned} snapshots scanned</span>
            <span>Limit {report.coverage.snapshot_scan_limit} snapshots</span>
            <span>Historical coverage incomplete</span>
          </div>
          <p className="caveat">{report.coverage.caveat}</p>
          {report.positions.length === 0 ? (
            <p className="muted">No positions were found in the retained source deals or scanned snapshots.</p>
          ) : (
            <div className="positions">
              {report.positions.map((position) => (
                <section className="position" key={position.external_position_id}>
                  <div className="position-header">
                    <div>
                      <p className="label">Broker position</p>
                      <strong className="mono">{position.external_position_id}</strong>
                    </div>
                    {position.canonical_trade ? (
                      <div className="trade-summary">
                        <span>{position.canonical_trade.symbol ?? "MT5 trade"} · {position.canonical_trade.status}</span>
                        <small className="muted">Trade {position.canonical_trade.trade_id}</small>
                      </div>
                    ) : (
                      <span className="muted">No canonical trade linked</span>
                    )}
                  </div>
                  {position.canonical_trade && (
                    <div className="trade-metrics">
                      <span>Opening volume: {position.canonical_trade.lot_size ?? "—"}</span>
                      <span>Realized P&amp;L: {position.canonical_trade.realized_pnl ?? "—"}</span>
                      <span>Opened: {position.canonical_trade.opened_at ? formatWhen(position.canonical_trade.opened_at) : "—"}</span>
                      <span>Closed: {position.canonical_trade.closed_at ? formatWhen(position.canonical_trade.closed_at) : "—"}</span>
                    </div>
                  )}
                  {position.events.length === 0 ? (
                    <p className="muted">No lifecycle events are available for this position.</p>
                  ) : (
                    <ol className="events">
                      {position.events.map((event, index) => {
                        const isDeal = event.event_type === "source_deal";
                        const title = isDeal
                          ? `Broker deal · ${event.entry_type ?? "unknown"}`
                          : `Snapshot observation · ${event.state ?? "unknown"}`;
                        const key = event.external_deal_id ?? event.snapshot_id ?? `${event.event_type}-${index}`;
                        return (
                          <li key={key} className="event">
                            <span className={`event-marker ${isDeal ? "deal" : event.state === "present" ? "present" : "absent"}`} />
                            <div className="event-content">
                              <div className="event-heading">
                                <strong>{title}</strong>
                                <time>{event.occurred_at ? formatWhen(event.occurred_at) : "Time unavailable"}</time>
                              </div>
                              {isDeal ? (
                                <>
                                  <p className="muted">
                                    {event.symbol_raw ?? "Symbol unavailable"} · {event.direction ?? "Direction unknown"} ·
                                    {" "}volume {event.volume ?? "—"} @ {event.price ?? "—"}
                                  </p>
                                  <p className="economics">
                                    Profit {event.profit ?? "—"} · Commission {event.commission ?? "—"} · Swap {event.swap ?? "—"}
                                  </p>
                                  <small className="muted">
                                    Deal {event.external_deal_id} · source row {event.source_deal_row_id}
                                  </small>
                                </>
                              ) : (
                                <>
                                  {event.position && (
                                    <p className="muted">
                                      {Object.entries(event.position).map(([field, value]) => `${field}: ${String(value)}`).join(" · ")}
                                    </p>
                                  )}
                                  <small className="muted">
                                    Snapshot {event.snapshot_id} · received {event.received_at ? formatWhen(event.received_at) : "time unavailable"}
                                  </small>
                                  {event.state === "absent" && (
                                    <p className="absence-note">Not present in this snapshot. This is not proof of closure.</p>
                                  )}
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              ))}
            </div>
          )}
          <p className="muted generated">Generated {report.generated_at ? formatWhen(report.generated_at) : "just now"}</p>
        </>
      )}
      <style jsx>{`
        .coverage, .trade-metrics { display: flex; flex-wrap: wrap; gap: 8px 14px; margin: 12px 0; color: var(--muted); font-size: 12px; }
        .caveat { font-size: 12px; color: var(--muted); padding: 9px 10px; border-left: 2px solid var(--warn); }
        .positions { display: grid; gap: 12px; margin-top: 14px; }
        .position { border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; min-width: 0; }
        .position-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .label { margin: 0 0 4px; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
        .mono { font-family: var(--font-mono), monospace; overflow-wrap: anywhere; }
        .trade-summary { display: flex; flex-direction: column; gap: 3px; text-align: right; }
        .events { list-style: none; margin: 12px 0 0; padding: 0 0 0 8px; border-left: 1px solid var(--border); display: grid; gap: 14px; }
        .event { position: relative; padding-left: 14px; min-width: 0; }
        .event-marker { position: absolute; width: 9px; height: 9px; border-radius: 50%; background: var(--muted); left: -13px; top: 5px; border: 2px solid var(--panel); }
        .event-marker.deal { background: var(--accent); }
        .event-marker.present { background: var(--accent); }
        .event-marker.absent { background: var(--warn); }
        .event-content { min-width: 0; }
        .event-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px 12px; }
        .event-heading time, .economics, .event small { font-size: 11px; color: var(--muted); }
        .event p { margin: 5px 0; overflow-wrap: anywhere; }
        .absence-note { font-size: 11px; color: var(--warn); }
        .generated { margin-top: 12px; font-size: 11px; }
        @media (max-width: 520px) { .trade-summary { text-align: left; } .event-heading { flex-direction: column; } }
      `}</style>
    </Panel>
  );
}
