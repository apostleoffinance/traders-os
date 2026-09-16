"use client";

import Link from "next/link";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { Badge } from "@/components/ui";
import { TraderOSTable } from "@/components/trader/TraderOSTable";
import type { Trade } from "@/lib/types";
import { formatDate, formatTime, money, sessionLabel, signed, tone } from "@/lib/format";

const col = createColumnHelper<Trade>();

/** Trade blotter — TanStack-backed, owned by TraderOS. */
export function TradeTable({
  trades,
  emptyMessage = "No trades for these filters.",
}: {
  trades: Trade[];
  emptyMessage?: string;
}) {
  const columns = useMemo(
    () =>
      [
      col.accessor((t) => t.trade_timestamp, {
        id: "date",
        header: "Date",
        cell: (info) => formatDate(info.getValue()),
      }),
      col.accessor((t) => t.trade_timestamp, {
        id: "time",
        header: "Time",
        cell: (info) => <span className="num">{formatTime(info.getValue())}</span>,
      }),
      col.accessor("symbol", {
        header: "Instrument",
        cell: (info) => (
          <Link href={`/trades/${info.row.original.id}`} className="font-medium underline-offset-2 hover:underline">
            {info.getValue()}
          </Link>
        ),
      }),
      col.accessor("session", {
        header: "Session",
        cell: (info) => sessionLabel(info.getValue()),
      }),
      col.accessor("direction", { header: "Dir" }),
      col.accessor("source", {
        header: "Source",
        cell: (info) => (info.getValue() === "mt5" ? "MT5" : "Manual"),
      }),
      col.accessor((t) => t.setup_name ?? "-", { id: "setup", header: "Setup" }),
      col.accessor("entry_price", {
        header: "Entry",
        cell: (info) => <span className="num">{info.getValue()}</span>,
      }),
      col.accessor("stop_loss", {
        header: "SL",
        cell: (info) => <span className="num">{info.getValue()}</span>,
      }),
      col.accessor((t) => t.take_profit ?? "-", {
        id: "tp",
        header: "TP",
        cell: (info) => <span className="num">{info.getValue()}</span>,
      }),
      col.accessor("lot_size", {
        header: "Lot",
        cell: (info) => <span className="num">{info.getValue()}</span>,
      }),
      col.accessor("risk_amount", {
        header: "Risk",
        cell: (info) => <span className="num">{money(info.getValue())}</span>,
      }),
      col.accessor("status", {
        header: "Status",
        cell: (info) => <Badge status={info.getValue()} />,
      }),
      col.accessor("result", {
        header: "Result",
        cell: (info) => <Badge status={info.getValue()} />,
      }),
      col.accessor((t) => (t.status === "open" ? null : t.realized_r), {
        id: "r",
        header: "R",
        cell: (info) => {
          const v = info.getValue();
          return <span className={`num ${tone(v)}`}>{v == null ? "—" : v}</span>;
        },
      }),
      col.accessor((t) => (t.status === "open" ? null : t.realized_pnl), {
        id: "pnl",
        header: "P/L",
        cell: (info) => {
          const v = info.getValue();
          return <span className={`num ${tone(v)}`}>{v == null ? "—" : signed(v)}</span>;
        },
      }),
      col.accessor((t) => t.discipline_score ?? "-", {
        id: "disc",
        header: "Disc.",
        cell: (info) => <span className="num">{info.getValue()}</span>,
      }),
      col.accessor((t) => t.psychology?.emotion_before ?? "-", {
        id: "emotion",
        header: "Emotion",
      }),
      col.display({
        id: "open",
        header: "",
        enableSorting: false,
        cell: (info) => (
          <Link href={`/trades/${info.row.original.id}`} className="font-semibold text-[var(--accent)]">
            Open
          </Link>
        ),
      }),
    ] as ColumnDef<Trade, unknown>[],
    [],
  );

  return (
    <TraderOSTable
      data={trades}
      columns={columns}
      getRowId={(t) => t.id}
      density="compact"
      emptyMessage={emptyMessage}
      enableSorting
      pageSize={trades.length > 50 ? 50 : undefined}
      caption="Trade history"
      className="rounded-[var(--radius)] border border-border bg-card"
    />
  );
}
