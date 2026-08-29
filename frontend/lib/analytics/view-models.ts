import type { AnalyticsDashboard, GroupRow } from "@/lib/analytics";
import { sessionLabel } from "@/lib/format";

export interface PerformanceMetrics {
  netPnl: number;
  totalR: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancyR: number | null;
  averageR: number | null;
  maxDrawdown: number;
  currentDrawdown: number;
  trades: number;
  grossPnl: number | null;
  averageWin: number | null;
  averageLoss: number | null;
  largestWin: number | null;
  largestLoss: number | null;
}

export interface GroupPerformanceRow {
  key: string;
  label: string;
  trades: number;
  netPnl: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancy: number | null;
  averageR: number | null;
}

export interface CostMetrics {
  grossPnl: number;
  commission: number;
  swap: number;
  netPnl: number;
  costDragPct: number | null;
  trades: number;
}

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? null : n;
}

export function getPerformanceMetrics(data: AnalyticsDashboard): PerformanceMetrics {
  const o = data.overview;
  const wl = data.lab?.performance.win_loss;
  const kpis = data.lab?.performance.kpis;

  return {
    netPnl: Number(o.net_pnl),
    totalR: Number(o.total_r),
    winRate: toNum(o.win_rate),
    profitFactor: toNum(o.profit_factor),
    expectancyR: toNum(o.expectancy_r),
    averageR: toNum(o.average_r),
    maxDrawdown: Number(o.max_drawdown),
    currentDrawdown: Number(o.current_drawdown),
    trades: o.n_trades,
    grossPnl: toNum(kpis?.gross_pnl?.value as string),
    averageWin: toNum(wl?.average_win),
    averageLoss: toNum(wl?.average_loss),
    largestWin: toNum(wl?.largest_winner),
    largestLoss: toNum(wl?.largest_loser),
  };
}

export function mapGroupRow(row: GroupRow, labelFn?: (key: string) => string): GroupPerformanceRow {
  return {
    key: row.key,
    label: labelFn ? labelFn(row.key) : row.label ?? row.key,
    trades: row.n,
    netPnl: Number(row.net_pnl),
    winRate: toNum(row.win_rate),
    profitFactor: toNum(row.profit_factor),
    expectancy: toNum(row.expectancy_r),
    averageR: toNum(row.average_r),
  };
}

export function getInstrumentPerformance(data: AnalyticsDashboard): GroupPerformanceRow[] {
  const rows =
    data.lab?.edge.instruments?.map((r) => ({
      key: r.key,
      label: r.label || r.key,
      trades: r.n,
      netPnl: Number(r.net_pnl ?? 0),
      winRate: toNum(r.win_rate),
      profitFactor: toNum(r.profit_factor),
      expectancy: toNum(r.expectancy_r),
      averageR: toNum(r.average_r),
    })) ?? data.setups.map((r) => mapGroupRow(r));

  return rows.filter((r) => r.trades > 0).sort((a, b) => (b.expectancy ?? -Infinity) - (a.expectancy ?? -Infinity));
}

export function getSetupPerformance(data: AnalyticsDashboard): GroupPerformanceRow[] {
  return data.setups.filter((r) => r.n > 0).map((r) => mapGroupRow(r)).sort((a, b) => (b.expectancy ?? -Infinity) - (a.expectancy ?? -Infinity));
}

export function getSessionPerformance(data: AnalyticsDashboard): GroupPerformanceRow[] {
  return data.sessions
    .filter((r) => r.n > 0)
    .map((r) => mapGroupRow(r, sessionLabel))
    .sort((a, b) => (b.expectancy ?? -Infinity) - (a.expectancy ?? -Infinity));
}

export function getCostMetrics(data: AnalyticsDashboard): CostMetrics | null {
  const gvn = data.lab?.costs.gross_vs_net;
  if (!gvn || gvn.n === 0) return null;

  return {
    grossPnl: Number(gvn.gross_pnl ?? 0),
    commission: Number(gvn.commission ?? 0),
    swap: Number(gvn.swap ?? 0),
    netPnl: Number(gvn.net_pnl ?? 0),
    costDragPct: toNum(gvn.cost_drag_pct),
    trades: gvn.n,
  };
}

export function topGroupByExpectancy(rows: GroupPerformanceRow[], minTrades = 3): GroupPerformanceRow | null {
  const eligible = rows.filter((r) => r.trades >= minTrades && r.expectancy !== null);
  if (!eligible.length) return null;
  return eligible.reduce((best, row) => ((row.expectancy ?? -Infinity) > (best.expectancy ?? -Infinity) ? row : best));
}

export function bottomGroupByExpectancy(rows: GroupPerformanceRow[], minTrades = 3): GroupPerformanceRow | null {
  const eligible = rows.filter((r) => r.trades >= minTrades && r.expectancy !== null);
  if (!eligible.length) return null;
  return eligible.reduce((worst, row) => ((row.expectancy ?? Infinity) < (worst.expectancy ?? Infinity) ? row : worst));
}
