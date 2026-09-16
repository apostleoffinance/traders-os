"use client";

import { flexRender, getCoreRowModel, getSortedRowModel, getPaginationRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type TableDensity = "comfortable" | "compact" | "terminal";

export type TraderOSTableProps<T> = {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  getRowId?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  density?: TableDensity;
  emptyMessage?: string;
  enableSorting?: boolean;
  pageSize?: number;
  className?: string;
  /** Accessible name for the table. */
  caption?: string;
};

const densityPad: Record<TableDensity, string> = {
  comfortable: "px-3 py-2.5",
  compact: "px-2 py-1.5",
  terminal: "px-1.5 py-1",
};

/**
 * Owned TanStack Table shell — sorting, optional pagination, density, row click.
 * Domain tables (TradeTable, ResearchTable, ReportTable) wrap this.
 */
export function TraderOSTable<T>({
  data,
  columns,
  getRowId,
  onRowClick,
  density = "compact",
  emptyMessage = "No rows to show.",
  enableSorting = true,
  pageSize,
  className,
  caption,
}: TraderOSTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const paginate = pageSize != null && pageSize > 0;

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getPaginationRowModel: paginate ? getPaginationRowModel() : undefined,
    initialState: paginate ? { pagination: { pageSize } } : undefined,
    getRowId: getRowId ? (row, i) => getRowId(row, i) : undefined,
    enableSorting,
  });

  const pad = densityPad[density];
  const rows = table.getRowModel().rows;

  if (data.length === 0) {
    return <p className="m-0 text-[13px] text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className={cn("w-full overflow-auto", className)}>
      <table className="w-full border-collapse text-[12.5px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={cn(
                      pad,
                      "border-b border-border text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap",
                      canSort && "cursor-pointer select-none hover:text-foreground",
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined
                    }
                  >
                    {header.isPlaceholder ? null : (
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? " ↑" : sorted === "desc" ? " ↓" : null}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                "border-b border-border",
                onRowClick && "cursor-pointer hover:bg-muted/60",
              )}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row.original);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={cn(pad, "whitespace-nowrap align-middle")}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {paginate && table.getPageCount() > 1 ? (
        <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
