"use client";

import type { ReactNode } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { TraderOSTable, type TableDensity } from "@/components/trader/TraderOSTable";

export type ResearchColumn<T> = {
  id: string;
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  numeric?: boolean;
  cell?: (value: string | number | null | undefined, row: T) => ReactNode;
};

/**
 * Generic research/analytics table — column config without hand-rolling TanStack each time.
 */
export function ResearchTable<T>({
  rows,
  columns,
  getRowId,
  onRowClick,
  emptyMessage = "No rows in this sample.",
  density = "compact",
  caption,
}: {
  rows: T[];
  columns: ResearchColumn<T>[];
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  density?: TableDensity;
  caption?: string;
}) {
  const defs = useMemo(() => {
    const helper = createColumnHelper<T>();
    return columns.map((c) =>
      helper.accessor((row) => c.accessor(row), {
        id: c.id,
        header: c.header,
        cell: (info) => {
          const v = info.getValue() as string | number | null | undefined;
          if (c.cell) return c.cell(v, info.row.original);
          if (v == null || v === "") return "—";
          return c.numeric ? <span className="num">{v}</span> : String(v);
        },
      }),
    ) as ColumnDef<T, unknown>[];
  }, [columns]);

  return (
    <TraderOSTable
      data={rows}
      columns={defs}
      getRowId={getRowId}
      onRowClick={onRowClick}
      emptyMessage={emptyMessage}
      density={density}
      caption={caption}
      enableSorting
    />
  );
}

/** Report appendix tables — same engine, slightly denser default. */
export function ReportTable<T>(props: Omit<Parameters<typeof ResearchTable<T>>[0], "density"> & { density?: TableDensity }) {
  return <ResearchTable {...props} density={props.density ?? "comfortable"} />;
}
