import { money, num } from "@/lib/format";
import { formatDateShort, formatSampleSize } from "./formatters";

/** Plain-English tooltip helpers — keep statistical jargon out of default copy. */

export function equityTooltipLine(args: {
  date: string;
  equity: number;
  currency: string;
  cumulativeR?: number | null;
}): string {
  const parts = [
    formatDateShort(args.date),
    `Equity ${money(args.equity, args.currency)}`,
  ];
  if (args.cumulativeR != null && Number.isFinite(args.cumulativeR)) {
    parts.push(`Cumulative ${num(args.cumulativeR)}R`);
  }
  return parts.join(" · ");
}

export function drawdownTooltipLine(args: {
  date: string;
  drawdown: number;
  drawdownPct: number;
  currency: string;
}): string {
  return `${formatDateShort(args.date)} · Drawdown ${money(args.drawdown, args.currency)} (${num(args.drawdownPct, 1)}%)`;
}

export function rankingTooltipLine(args: {
  label: string;
  expectancyR: number | null;
  winRate: number | null;
  n: number;
}): string {
  const exp = args.expectancyR != null ? `${num(args.expectancyR)}R expectancy` : "Expectancy —";
  const wr = args.winRate != null ? `${num(args.winRate, 1)}% win rate` : null;
  return [args.label, exp, wr, formatSampleSize(args.n)].filter(Boolean).join(" · ");
}

export function lookForHint(question: string): string {
  return `What to look for: ${question}`;
}
