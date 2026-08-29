import type { AnalyticsInsight } from "@/lib/analytics/types";
import { classifyConfidence } from "@/lib/analytics/confidence";
import { ANALYTICS_MIN_SAMPLE } from "@/lib/analytics/sample";
import type { GroupPerformanceRow } from "@/lib/analytics/view-models";
import { num, signed } from "@/lib/format";

type GroupDimension = "instrument" | "setup" | "session";

const DIMENSION_LABEL: Record<GroupDimension, string> = {
  instrument: "instrument",
  setup: "setup",
  session: "session",
};

export function generateGroupedInsight(
  rows: GroupPerformanceRow[],
  dimension: GroupDimension,
  minimumSample = ANALYTICS_MIN_SAMPLE,
): AnalyticsInsight | null {
  const eligible = rows.filter((r) => r.trades >= 3);
  const totalN = rows.reduce((sum, r) => sum + r.trades, 0);
  const strength = classifyConfidence(totalN, undefined, minimumSample);

  if (!eligible.length) {
    return {
      summary: `Grouped ${DIMENSION_LABEL[dimension]} results for the filtered sample.`,
      observation: "Not enough trades per group yet to compare reliably.",
      takeaway: "Log more trades across groups before drawing conclusions.",
      sampleSize: totalN,
      strength: "insufficient",
      direction: "neutral",
      warning: strength === "insufficient" ? `Early signal only — based on ${totalN} trade${totalN === 1 ? "" : "s"}.` : undefined,
    };
  }

  const byExpectancy = [...eligible].sort((a, b) => (b.expectancy ?? -Infinity) - (a.expectancy ?? -Infinity));
  const best = byExpectancy[0];
  const worst = byExpectancy[byExpectancy.length - 1];

  const bestExp = best.expectancy ?? 0;
  const worstExp = worst.expectancy ?? 0;

  let observation: string;
  let takeaway: string | undefined;
  let direction: AnalyticsInsight["direction"] = "neutral";

  if (best.key === worst.key) {
    observation = `${best.label} is the only ${DIMENSION_LABEL[dimension]} with enough trades in this sample.`;
    takeaway = "Add more trades across other groups to compare edge drivers.";
  } else if (bestExp > 0 && worstExp < 0) {
    observation = `${best.label} shows the highest observed expectancy (${signed(bestExp)}R, n=${best.trades}), while ${worst.label} is negative (${signed(worstExp)}R, n=${worst.trades}).`;
    takeaway = `Review whether ${worst.label} trades meet the same quality criteria as ${best.label}.`;
    direction = "mixed";
  } else if (bestExp > 0) {
    observation = `Your strongest observed edge is ${best.label}, with an expectancy of ${signed(bestExp)}R (n=${best.trades}).`;
    takeaway = `Consider whether ${best.label} deserves more focused review in your playbook.`;
    direction = "positive";
  } else {
    observation = `No ${DIMENSION_LABEL[dimension]} shows positive expectancy in this sample. ${best.label} is least negative at ${signed(bestExp)}R (n=${best.trades}).`;
    takeaway = "Investigate whether filters, sizing, or execution differ across groups.";
    direction = "negative";
  }

  const fragile = best.netPnl > 0 && best.profitFactor !== null && best.profitFactor < 1.2;
  const warning = fragile
    ? `${best.label} is profitable in this sample, but the profit factor suggests the edge may be fragile.`
    : strength === "early"
      ? `Early signal only — based on ${totalN} trades across groups.`
      : undefined;

  return {
    summary: `Ranked ${DIMENSION_LABEL[dimension]} performance in this sample.`,
    observation,
    takeaway,
    sampleSize: totalN,
    strength,
    direction,
    warning,
  };
}

export function generateInstrumentInsight(rows: GroupPerformanceRow[]): AnalyticsInsight | null {
  return generateGroupedInsight(rows, "instrument");
}

export function generateSetupInsight(rows: GroupPerformanceRow[]): AnalyticsInsight | null {
  return generateGroupedInsight(rows, "setup");
}

export function generateSessionInsight(rows: GroupPerformanceRow[]): AnalyticsInsight | null {
  return generateGroupedInsight(rows, "session");
}

export function generatePerformanceInsight(metrics: {
  netPnl: number;
  winRate: number | null;
  profitFactor: number | null;
  expectancyR: number | null;
  trades: number;
}): AnalyticsInsight {
  const strength = classifyConfidence(metrics.trades);
  const profitable = metrics.netPnl > 0;
  const direction: AnalyticsInsight["direction"] = profitable ? "positive" : metrics.netPnl < 0 ? "negative" : "neutral";

  let observation: string;
  if (metrics.trades < 5) {
    observation = "Sample is still very small — headline metrics may shift significantly.";
  } else if (profitable && (metrics.profitFactor ?? 0) >= 1.3) {
    observation = `Historically profitable in this sample with a profit factor of ${num(metrics.profitFactor)}.`;
  } else if (profitable && (metrics.profitFactor ?? 0) < 1.2) {
    observation = "Net P&L is positive, but profit factor suggests the edge may be fragile.";
  } else if (!profitable) {
    observation = `Net P&L is negative in this sample${metrics.expectancyR !== null ? ` with ${signed(metrics.expectancyR)}R expectancy` : ""}.`;
  } else {
    observation = `Win rate is ${metrics.winRate !== null ? `${num(metrics.winRate, 1)}%` : "—"} with ${metrics.expectancyR !== null ? `${signed(metrics.expectancyR)}R` : "—"} expectancy.`;
  }

  return {
    summary: "Core performance metrics for the filtered period.",
    observation,
    takeaway: profitable
      ? "Focus on what is driving winners and whether losers follow the same rules."
      : "Review whether risk, setup selection, or execution changed during this period.",
    sampleSize: metrics.trades,
    strength,
    direction,
    warning: strength === "early" ? `Early signal only — based on ${metrics.trades} trades.` : undefined,
  };
}

export function generateWinLossInsight(metrics: {
  winRate: number | null;
  lossRate: number | null;
  winLossRatio: number | null;
  trades: number;
}): AnalyticsInsight {
  const strength = classifyConfidence(metrics.trades);
  const wr = metrics.winRate ?? 0;
  const ratio = metrics.winLossRatio;

  let observation: string;
  if (wr >= 55 && ratio !== null && ratio < 1) {
    observation = `Win rate is ${num(wr, 1)}%, but average losses are larger than average wins (payoff ${num(ratio)}).`;
  } else if (wr < 45 && ratio !== null && ratio >= 1.2) {
    observation = `Lower win rate (${num(wr, 1)}%) is offset by a favorable payoff ratio (${num(ratio)}).`;
  } else {
    observation = `Wins ${num(wr, 1)}% of trades in this sample${ratio !== null ? ` with a ${num(ratio)} payoff ratio` : ""}.`;
  }

  return {
    summary: "Outcome mix across closed trades.",
    observation,
    takeaway: "A healthy system needs either strong win rate or strong payoff — ideally both.",
    sampleSize: metrics.trades,
    strength,
    direction: wr >= 50 ? "positive" : wr < 45 ? "negative" : "neutral",
  };
}

export function generateCostInsight(metrics: {
  grossPnl: number;
  netPnl: number;
  costDragPct: number | null;
  trades: number;
}): AnalyticsInsight {
  const strength = classifyConfidence(metrics.trades);
  const drag = metrics.costDragPct;

  let observation: string;
  if (drag !== null && drag >= 15) {
    observation = `Costs reduced gross performance by ${num(drag, 1)}% in this sample.`;
  } else if (metrics.grossPnl > 0 && metrics.netPnl <= 0) {
    observation = "Gross P&L was positive, but costs pushed net results negative.";
  } else if (drag !== null && drag > 0) {
    observation = `Trading costs consumed ${num(drag, 1)}% of gross gains.`;
  } else {
    observation = "Cost drag is modest relative to gross performance in this sample.";
  }

  return {
    summary: "How commissions and swap affect gross results.",
    observation,
    takeaway: drag !== null && drag >= 10 ? "Review trade frequency and symbol costs if drag feels high." : undefined,
    sampleSize: metrics.trades,
    strength,
    direction: drag !== null && drag >= 15 ? "negative" : "neutral",
  };
}

export function generateEquityInsight(metrics: {
  netPnl: number;
  maxDrawdown: number;
  currentDrawdown: number;
  trades: number;
}): AnalyticsInsight {
  const strength = classifyConfidence(metrics.trades);
  const growing = metrics.netPnl > 0;
  const inDrawdown = metrics.currentDrawdown < 0;

  let observation: string;
  if (growing && !inDrawdown) {
    observation = "Equity is net positive and not currently in drawdown.";
  } else if (growing && inDrawdown) {
    observation = `Net positive overall, but currently ${Math.abs(metrics.currentDrawdown).toFixed(0)} below peak equity.`;
  } else if (!growing) {
    observation = "Equity trend is negative in this sample.";
  } else {
    observation = "Equity is flat in this sample.";
  }

  return {
    summary: "Cumulative equity path for closed trades in this period.",
    observation,
    takeaway: inDrawdown ? "Review whether recent trades differ from your best-performing conditions." : undefined,
    sampleSize: metrics.trades,
    strength,
    direction: growing ? "positive" : metrics.netPnl < 0 ? "negative" : "neutral",
  };
}

export function generateMfeMaeInsight(metrics: {
  coverageN: number;
  totalN: number;
  avgMfe: number | null;
  avgMae: number | null;
}): AnalyticsInsight {
  const strength = classifyConfidence(metrics.coverageN);
  const mfe = metrics.avgMfe ?? 0;
  const mae = Math.abs(metrics.avgMae ?? 0);

  let observation: string;
  if (metrics.coverageN < 5) {
    observation = "Not enough trades with excursion data for a reliable read.";
  } else if (mfe > mae * 1.5) {
    observation = `Average favorable movement (${mfe.toFixed(2)}R MFE) exceeds adverse movement (${mae.toFixed(2)}R MAE) in this sample.`;
  } else if (mae > mfe) {
    observation = `Average adverse movement (${mae.toFixed(2)}R MAE) exceeds favorable movement (${mfe.toFixed(2)}R MFE) — review stop placement.`;
  } else {
    observation = `MFE and MAE are relatively balanced (avg ${mfe.toFixed(2)}R vs ${mae.toFixed(2)}R).`;
  }

  return {
    summary: "Maximum favorable excursion (MFE) vs maximum adverse excursion (MAE) per trade.",
    observation,
    takeaway: "Top-left points: large favorable move with limited adverse move. Bottom-right: large adverse move.",
    sampleSize: metrics.coverageN,
    strength,
    direction: mfe > mae ? "positive" : mfe < mae ? "negative" : "neutral",
    methodology: "MFE = best unrealized gain during trade. MAE = worst unrealized loss during trade.",
  };
}

export function generateExitEfficiencyInsight(metrics: {
  coverageN: number;
  medianCapturePct: number | null;
  insightText?: string | null;
}): AnalyticsInsight {
  const strength = classifyConfidence(metrics.coverageN);
  const capture = metrics.medianCapturePct;

  let observation: string;
  if (metrics.insightText) {
    observation = metrics.insightText;
  } else if (capture === null) {
    observation = "Capture data is limited in this sample.";
  } else if (capture >= 60) {
    observation = `Median capture is ${capture.toFixed(0)}% — you are retaining a solid share of favorable movement on winners.`;
  } else if (capture < 40) {
    observation = `Median capture is ${capture.toFixed(0)}% — winners may be exiting before typical favorable movement is captured.`;
  } else {
    observation = `Median capture is ${capture.toFixed(0)}% in this sample.`;
  }

  return {
    summary: "How much of each winner's favorable movement was captured at exit.",
    observation,
    takeaway: capture !== null && capture < 50 ? "Review exit rules on trades that showed strong favorable movement." : undefined,
    sampleSize: metrics.coverageN,
    strength,
    direction: capture !== null && capture >= 55 ? "positive" : capture !== null && capture < 40 ? "negative" : "neutral",
  };
}

export function generateTimeOfDayInsight(
  hours: { hour: number; n: number; expectancy: number | null }[],
): AnalyticsInsight | null {
  const eligible = hours.filter((h) => h.n >= 3 && h.expectancy !== null);
  const totalN = hours.reduce((s, h) => s + h.n, 0);
  if (!eligible.length) {
    return {
      summary: "Hourly performance in your timezone.",
      observation: "Not enough trades per hour to compare reliably.",
      sampleSize: totalN,
      strength: classifyConfidence(totalN),
      direction: "neutral",
    };
  }

  const best = [...eligible].sort((a, b) => (b.expectancy ?? 0) - (a.expectancy ?? 0))[0];
  const worst = [...eligible].sort((a, b) => (a.expectancy ?? 0) - (b.expectancy ?? 0))[0];

  return {
    summary: "Hourly expectancy across closed trades.",
    observation:
      best.hour === worst.hour
        ? `${best.hour}:00 has the highest observed expectancy (${(best.expectancy ?? 0).toFixed(2)}R, n=${best.n}).`
        : `${best.hour}:00 shows the strongest expectancy (${(best.expectancy ?? 0).toFixed(2)}R) vs ${worst.hour}:00 (${(worst.expectancy ?? 0).toFixed(2)}R).`,
    takeaway: "Association only — hour alone does not cause results.",
    sampleSize: totalN,
    strength: classifyConfidence(totalN),
    direction: (best.expectancy ?? 0) > 0 && (worst.expectancy ?? 0) < 0 ? "mixed" : "neutral",
  };
}

export function generateBucketInsight(
  buckets: { label: string; n: number; expectancy: number | null }[],
  context: string,
): AnalyticsInsight | null {
  const eligible = buckets.filter((b) => b.n >= 3 && b.expectancy !== null);
  const totalN = buckets.reduce((s, b) => s + b.n, 0);
  if (!eligible.length) {
    return {
      summary: context,
      observation: "Buckets need more trades before comparison is meaningful.",
      sampleSize: totalN,
      strength: classifyConfidence(totalN),
      direction: "neutral",
    };
  }
  const best = [...eligible].sort((a, b) => (b.expectancy ?? 0) - (a.expectancy ?? 0))[0];
  return {
    summary: context,
    observation: `Strongest observed bucket: ${best.label} (${(best.expectancy ?? 0).toFixed(2)}R expectancy, n=${best.n}).`,
    takeaway: "Historical bucket results — not a sizing or timing recommendation.",
    sampleSize: totalN,
    strength: classifyConfidence(totalN),
    direction: (best.expectancy ?? 0) >= 0 ? "positive" : "negative",
  };
}
