import type { AnalyticsDashboard } from "@/lib/analytics";
import type { AnalyticsPageId } from "@/lib/analytics/types";
import { classifyConfidence } from "@/lib/analytics/confidence";
import {
  getCostMetrics,
  getInstrumentPerformance,
  getPerformanceMetrics,
  getSessionPerformance,
  getSetupPerformance,
} from "@/lib/analytics/view-models";
import { num, signed } from "@/lib/format";

export type InvestigationSeverity = "positive" | "warn" | "info";

export interface InvestigationItem {
  id: string;
  severity: InvestigationSeverity;
  title: string;
  summary: string;
  sampleSize?: number;
  tab?: AnalyticsPageId;
  href?: string;
  priority: number;
}


export function buildInvestigationQueue(data: AnalyticsDashboard): InvestigationItem[] {
  const items: InvestigationItem[] = [];
  const perf = getPerformanceMetrics(data);
  const sessions = getSessionPerformance(data);
  const instruments = getInstrumentPerformance(data);
  const setups = getSetupPerformance(data);
  const costs = getCostMetrics(data);
  const lab = data.lab;

  if (perf.trades < 5) {
    items.push({
      id: "sample_size",
      severity: "info",
      title: "Small sample",
      summary: `Only ${perf.trades} closed trade${perf.trades === 1 ? "" : "s"} in this filter — most comparisons are early signals.`,
      sampleSize: perf.trades,
      priority: 90,
    });
  }

  const sessionEligible = sessions.filter((s) => s.trades >= 5 && s.expectancy !== null);
  if (sessionEligible.length >= 2) {
    const sorted = [...sessionEligible].sort((a, b) => (b.expectancy ?? 0) - (a.expectancy ?? 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const gap = (best.expectancy ?? 0) - (worst.expectancy ?? 0);
    if (gap >= 0.3 && (worst.expectancy ?? 0) < 0) {
      items.push({
        id: "session_gap",
        severity: "warn",
        title: "Session difference",
        summary: `${worst.label} expectancy (${signed(worst.expectancy)}R) is materially lower than ${best.label} (${signed(best.expectancy)}R).`,
        sampleSize: worst.trades + best.trades,
        tab: "edge",
        priority: 70,
      });
    }
  }

  const topInstrument = instruments.find((r) => r.trades >= 5 && (r.expectancy ?? 0) > 0);
  if (topInstrument) {
    items.push({
      id: "strongest_instrument",
      severity: "positive",
      title: "Strongest observed edge",
      summary: `${topInstrument.label} currently has your strongest observed expectancy (${signed(topInstrument.expectancy)}R).`,
      sampleSize: topInstrument.trades,
      tab: "edge",
      priority: 40,
    });
  }

  if (perf.netPnl > 0 && perf.profitFactor !== null && perf.profitFactor < 1.15) {
    items.push({
      id: "fragile_pf",
      severity: "warn",
      title: "Fragile profit factor",
      summary: `Net P&L is positive, but profit factor (${num(perf.profitFactor)}) suggests the edge may be fragile.`,
      sampleSize: perf.trades,
      tab: "performance",
      priority: 60,
    });
  }

  if (costs && costs.costDragPct !== null && costs.costDragPct >= 12) {
    items.push({
      id: "cost_drag",
      severity: "warn",
      title: "Cost drag",
      summary: `Costs reduced gross performance by ${num(costs.costDragPct, 1)}% in this sample.`,
      sampleSize: costs.trades,
      tab: "performance",
      priority: 55,
    });
  }

  const consistency = data.consistency;
  if (consistency.trading_days > 0 && perf.trades / consistency.trading_days >= 6 && (perf.expectancyR ?? 0) < 0) {
    items.push({
      id: "overtrading",
      severity: "warn",
      title: "High activity, negative expectancy",
      summary: `Your busiest days (${(perf.trades / consistency.trading_days).toFixed(1)} trades/day avg) coincide with negative expectancy in this sample.`,
      sampleSize: perf.trades,
      tab: "execution",
      priority: 65,
    });
  }

  const exit = lab?.execution.exit_efficiency;
  if (exit?.available && (exit.coverage_n ?? 0) >= 10) {
    const capture = exit.median_capture_pct ? Number(exit.median_capture_pct) : null;
    if (capture !== null && capture < 45) {
      items.push({
        id: "exit_efficiency",
        severity: "warn",
        title: "Exit efficiency",
        summary:
          exit.insight ??
          "Winning trades may be exiting before capturing their typical favorable movement.",
        sampleSize: exit.coverage_n,
        tab: "execution",
        priority: 50,
      });
    }
  }

  const rolling = data.rolling_expectancy;
  if (rolling.length >= 10) {
    const recent = rolling.slice(-5);
    const older = rolling.slice(-10, -5);
    const recentAvg = recent.reduce((s, p) => s + Number(p.expectancy_r), 0) / recent.length;
    const olderAvg = older.reduce((s, p) => s + Number(p.expectancy_r), 0) / older.length;
    if (olderAvg > 0.1 && recentAvg < 0 && recentAvg < olderAvg - 0.25) {
      items.push({
        id: "rolling_decline",
        severity: "warn",
        title: "Rolling expectancy decline",
        summary: "Recent rolling expectancy is weaker than the prior window in this sample.",
        sampleSize: perf.trades,
        tab: "quant_lab",
        href: "/quant-lab?tab=overview",
        priority: 45,
      });
    }
  }

  const weakestSetup = setups.find((s) => s.trades >= 5 && (s.expectancy ?? 0) < -0.2);
  if (weakestSetup) {
    items.push({
      id: "weak_setup",
      severity: "info",
      title: "Setup review",
      summary: `${weakestSetup.label} shows negative expectancy (${signed(weakestSetup.expectancy)}R) — may be worth investigating.`,
      sampleSize: weakestSetup.trades,
      tab: "edge",
      priority: 35,
    });
  }

  if (perf.currentDrawdown < 0 && Math.abs(perf.currentDrawdown) > Math.abs(perf.maxDrawdown) * 0.6) {
    items.push({
      id: "drawdown",
      severity: "warn",
      title: "Elevated drawdown",
      summary: "Current drawdown is a large portion of max drawdown in this sample.",
      sampleSize: perf.trades,
      tab: "risk",
      priority: 75,
    });
  }

  const strength = classifyConfidence(perf.trades);
  if (strength === "insufficient" && items.every((i) => i.id !== "sample_size")) {
    items.push({
      id: "insufficient_evidence",
      severity: "info",
      title: "Early evidence only",
      summary: "Most analytical claims need more closed trades before they become reliable.",
      sampleSize: perf.trades,
      priority: 85,
    });
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 6);
}
