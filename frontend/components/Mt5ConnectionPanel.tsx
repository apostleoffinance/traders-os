"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createMt5Connection,
  fetchMt5Connection,
  mt5NeedsSetup,
  mt5StatusLabel,
  regenerateMt5Connection,
  revokeMt5Connection,
} from "@/lib/mt5";
import type { Mt5Connection } from "@/lib/types";
import { formatWhen } from "@/lib/format";
import { Alert, Button, Panel } from "@/components/ui";
import { Mt5ConnectDrawer } from "@/components/Mt5ConnectDrawer";

type Props = {
  accountId: string;
  /** When true, open the connect wizard on mount (e.g. from accounts list). */
  autoOpen?: boolean;
};

export function Mt5ConnectionPanel({ accountId, autoOpen = false }: Props) {
  const [connection, setConnection] = useState<Mt5Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const row = await fetchMt5Connection(accountId);
      setConnection(row);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load MT5 status");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (autoOpen) setDrawerOpen(true);
  }, [autoOpen]);

  // Poll while waiting for the EA to connect.
  useEffect(() => {
    if (!connection || connection.status === "revoked" || connection.status === "connected") return;
    const id = window.setInterval(() => void reload(), 5000);
    return () => window.clearInterval(id);
  }, [connection, reload]);

  async function onDisconnect() {
    if (!connection || connection.status === "revoked") return;
    if (!window.confirm("Disconnect MT5? The EA will stop syncing until you connect again.")) return;
    try {
      await revokeMt5Connection(connection.id);
      setFreshToken(null);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    }
  }

  async function onRegenerate() {
    if (!connection || connection.status === "revoked") return;
    if (!window.confirm("Regenerate connection code? The previous EA token will stop working.")) return;
    try {
      const created = await regenerateMt5Connection(connection.id);
      setFreshToken(created.connection_token);
      setConnection(created);
      setDrawerOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regenerate failed");
    }
  }

  const status = connection?.status ?? "disconnected";
  const live = status === "connected";
  const awaiting = status === "pending";

  return (
    <>
      <Panel
        title="MetaTrader 5 automatic sync"
        right={
          connection && connection.status !== "revoked" ? (
            <Button type="button" kind="ghost" onClick={() => void onDisconnect()}>
              Disconnect MT5
            </Button>
          ) : null
        }
      >
        <p className="muted">
          Trades sync from your MT5 terminal while the Expert Advisor is running. Read-only — cannot
          place or close trades.
        </p>
        {error && <Alert kind="danger">{error}</Alert>}
        {loading ? (
          <p className="muted">Loading connection…</p>
        ) : connection && connection.status !== "revoked" ? (
          <>
            <div className="status-grid">
              <div>
                <p className="label">Status</p>
                <span className={`sync-pill ${live ? "live" : status === "stale" ? "stale" : awaiting ? "pending" : ""}`}>
                  {mt5StatusLabel(status)}
                </span>
              </div>
              {connection.mt5_login && (
                <div>
                  <p className="label">MT5 account</p>
                  <p>{connection.mt5_login}</p>
                </div>
              )}
              {connection.broker_name && (
                <div>
                  <p className="label">Broker</p>
                  <p>{connection.broker_name}</p>
                </div>
              )}
              <div>
                <p className="label">Last sync</p>
                <p>{connection.last_sync_at ? formatWhen(connection.last_sync_at) : "—"}</p>
              </div>
              <div>
                <p className="label">Token prefix</p>
                <p className="mono">{connection.token_prefix}…</p>
              </div>
            </div>
            {awaiting && (
              <Alert kind="info">
                Waiting for the EA to connect. Open the setup guide, finish installation in MT5, then
                leave Algo Trading enabled.
              </Alert>
            )}
            {status === "stale" && (
              <Alert kind="warn">
                No sync received recently. Check that MT5 is open, Algo Trading is on, and the EA is
                still attached to a chart.
              </Alert>
            )}
          </>
        ) : (
          <p className="muted">Not connected — set up once to journal trades automatically.</p>
        )}
        <div className="actions">
          {(!connection || connection.status === "revoked") && (
            <Button type="button" onClick={() => setDrawerOpen(true)}>
              Connect MT5
            </Button>
          )}
          {connection && connection.status !== "revoked" && (
            <>
              <Button type="button" onClick={() => setDrawerOpen(true)}>
                {mt5NeedsSetup(status) ? "Finish MT5 setup" : "Setup guide"}
              </Button>
              <Button type="button" kind="ghost" onClick={() => void onRegenerate()}>
                Regenerate code
              </Button>
            </>
          )}
        </div>
      </Panel>
      <Mt5ConnectDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setFreshToken(null);
          void reload();
        }}
        accountId={accountId}
        existingConnection={connection}
        initialToken={freshToken}
        onCreated={(created) => {
          setConnection(created);
          setFreshToken(created.connection_token);
        }}
        createConnection={createMt5Connection}
      />
      <style jsx>{`
        .status-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 14px;
          margin: 12px 0;
        }
        .label {
          margin: 0 0 4px;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .mono {
          font-family: var(--font-mono), monospace;
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 8px;
        }
        .sync-pill {
          display: inline-block;
          font-family: var(--font-mono), monospace;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.08em;
          padding: 4px 9px;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
        }
        .sync-pill.live {
          border-color: var(--accent);
          color: var(--accent);
        }
        .sync-pill.stale {
          border-color: var(--warn);
          color: var(--warn);
        }
        .sync-pill.pending {
          border-color: var(--muted);
          color: var(--muted);
        }
      `}</style>
    </>
  );
}
