import { api } from "@/lib/api";
import type { Mt5Connection } from "@/lib/types";

export type Mt5ConnectionCreated = Mt5Connection & {
  connection_token: string;
};

/** Base URL the MT5 EA should call (not the Next.js browser proxy path). */
export function mt5ApiBaseUrl(): string {
  const override = process.env.NEXT_PUBLIC_MT5_API_URL?.trim();
  if (override) return override.replace(/\/+$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
    }
    // Production: same origin — Next.js rewrites /api/* to the backend.
    return window.location.origin.replace(/\/+$/, "");
  }

  return (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
}

export function mt5EaDownloadUrl(): string {
  const custom = process.env.NEXT_PUBLIC_MT5_EA_DOWNLOAD_URL?.trim();
  if (custom) return custom;
  return "/downloads/TraderOSSync.zip";
}

export function fetchMt5Connections(): Promise<Mt5Connection[]> {
  return api<Mt5Connection[]>("/api/integrations/mt5/connections");
}

export function fetchMt5Connection(accountId: string): Promise<Mt5Connection | null> {
  return api<Mt5Connection | null>(`/api/integrations/mt5/connections/by-account/${accountId}`);
}

export function createMt5Connection(accountId: string): Promise<Mt5ConnectionCreated> {
  return api<Mt5ConnectionCreated>("/api/integrations/mt5/connections", {
    method: "POST",
    body: JSON.stringify({ account_id: accountId }),
  });
}

export function regenerateMt5Connection(connectionId: string): Promise<Mt5ConnectionCreated> {
  return api<Mt5ConnectionCreated>(`/api/integrations/mt5/connections/${connectionId}/regenerate`, {
    method: "POST",
  });
}

export function revokeMt5Connection(connectionId: string): Promise<Mt5Connection> {
  return api<Mt5Connection>(`/api/integrations/mt5/connections/${connectionId}/revoke`, {
    method: "POST",
  });
}

export function mt5StatusLabel(status: string): string {
  switch (status) {
    case "connected":
      return "LIVE SYNC";
    case "stale":
      return "SYNC DELAYED";
    case "revoked":
      return "CONNECTION REVOKED";
    case "pending":
      return "AWAITING EA";
    default:
      return "NOT CONNECTED";
  }
}

export function mt5NeedsSetup(status: string | undefined): boolean {
  return !status || status === "pending" || status === "disconnected";
}


export type Mt5ReconciliationIssue = {
  code: string;
  severity: "error" | "warning" | "info";
  message: string;
  external_deal_id?: string | null;
  external_position_id?: string | null;
  trade_id?: string | null;
  field?: string;
  source_value?: string;
  processed_value?: string;
  snapshot_value?: string;
  snapshot_id?: string;
  snapshot_received_at?: string | null;
  snapshot_sync_timestamp?: string | null;
  source_deal_row_id?: string;
  processed_deal_row_id?: string;
};

export type Mt5ReconciliationReport = {
  connection_id: string;
  account_id: string;
  generated_at: string;
  latest_snapshot: {
    id: string;
    received_at: string | null;
    sync_timestamp: string | null;
    positions_count: number;
    deals_count: number;
  } | null;
  coverage: {
    source_deal_rows: number;
    source_closing_deals: number;
    processed_deals: number;
    canonical_mt5_trades: number;
    broker_open_positions_in_latest_snapshot: number;
    snapshots_scanned: number;
    snapshot_scan_limit: number;
    snapshot_deal_ids_observed: number;
    snapshot_deal_ids_missing_from_source_ledger: number;
    newest_scanned_snapshot_received_at: string | null;
    historical_source_coverage: string;
  };
  summary: {
    status: "consistent" | "issues_found";
    issue_count: number;
    error_count: number;
    warning_count: number;
    info_count: number;
  };
  issues: Mt5ReconciliationIssue[];
};

export function fetchMt5Reconciliation(connectionId: string): Promise<Mt5ReconciliationReport> {
  return api<Mt5ReconciliationReport>(
    `/api/integrations/mt5/connections/${connectionId}/reconciliation`,
  );
}

export type Mt5SnapshotEvidence = {
  snapshot_id: string;
  connection_id: string;
  account_id: string;
  received_at: string | null;
  sync_timestamp: string | null;
  positions_count: number;
  deals_count: number;
  payload: Record<string, unknown>;
};

export function fetchMt5SnapshotEvidence(connectionId: string, snapshotId: string): Promise<Mt5SnapshotEvidence> {
  return api<Mt5SnapshotEvidence>(
    "/api/integrations/mt5/connections/" + connectionId + "/snapshots/" + snapshotId,
  );
}
