import type { AnalyticsDashboard, IntelligenceLabPayload, IntelligenceInsightCard } from "@/lib/analytics";
import { buildInvestigationQueue, type InvestigationItem } from "@/lib/analytics/investigation";
import {
  getPerformanceMetrics,
  getSessionPerformance,
  topGroupByExpectancy,
  bottomGroupByExpectancy,
} from "@/lib/analytics/view-models";
import { num, signed } from "@/lib/format";
import type { IntelligenceFeedResponse, IntelligenceInsight } from "./feed";
import {
  confidenceFromSample,
  severityFromFeed,
  severityFromInvestigation,
  severityFromLab,
  strengthFromLabConfidence,
  findingConfidenceLabel,
} from "./evidence";
import {
  defaultActionLabel,
  destinationFor,
  domainFromCategory,
  typeFromCategory,
} from "./destinations";
import {
  MIN_GROUP_TRADES,
  MIN_POST_LOSS_TRADES,
  RISK_AFTER_LOSS_PCT,
  SESSION_GAP_R,
} from "./thresholds";
import type {
  Finding,
  FindingDomain,
  FindingEvidenceItem,
  FindingMetric,
  FindingType,
} from "./types";

function metric(key: string, label: string, value: string, tone?: FindingMetric["tone"]): FindingMetric {
  return { key, label, value, tone };
}

function evidenceItems(entries: Array<[string, string, FindingEvidenceItem["tone"]?]>): FindingEvidenceItem[] {
  return entries.map(([label, value, tone]) => ({ label, value, tone }));
}

function toneR(v: number | null | undefined): FindingMetric["tone"] {
  if (v == null || Number.isNaN(v)) return "neutral";
  if (v > 0) return "pos";
  if (v < 0) return "neg";
  return "neutral";
}

/** Convert Overview investigation items into Findings. */
export function findingsFromInvestigation(
  data: AnalyticsDashboard,
  generatedAt: string,
): Finding[] {
  return buildInvestigationQueue(data).map((item) => investigationToFinding(item, generatedAt));
}

function investigationToFinding(item: InvestigationItem, generatedAt: string): Finding {
  const domain: FindingDomain =
    item.tab === "edge"
      ? "edge"
      : item.tab === "execution"
        ? "execution"
        : item.tab === "risk"
          ? "risk"
          : item.tab === "behaviour"
            ? "behaviour"
            : item.tab === "calendar"
              ? "calendar"
              : item.tab === "quant_lab"
                ? "quant"
                : item.tab === "performance"
                  ? "performance"
                  : "general";

  const type: FindingType =
    item.id.includes("edge") || item.id.includes("session") || item.id.includes("instrument") || item.id.includes("setup")
      ? item.severity === "positive"
        ? "OPPORTUNITY"
        : "EDGE"
      : item.id.includes("exit")
        ? "EXECUTION"
        : item.id.includes("drawdown") || item.id.includes("risk")
          ? "RISK"
          : item.id.includes("overtrad")
            ? "BEHAVIOUR"
            : item.severity === "warn"
              ? "WARNING"
              : "PERFORMANCE";

  const sampleSize = item.sampleSize ?? 0;
  const { strength, label } = confidenceFromSample(sampleSize);
  const dest = item.href
    ? { label: destinationFor(domain).label, href: item.href, tab: item.tab }
    : destinationFor(domain);

  return {
    id: `inv:${item.id}`,
    type,
    title: item.title,
    summary: item.summary,
    domain,
    severity: severityFromInvestigation(item.severity),
    confidenceStrength: strength,
    confidence: label,
    sampleSize,
    metric: null,
    comparison: null,
    evidence: sampleSize > 0 ? evidenceItems([["Sample", `${sampleSize} trades`]]) : [],
    whyItMatters: item.summary,
    whySurfaced: `TraderOS surfaced this from deterministic analytics on your filtered sample${sampleSize ? ` (${sampleSize} trades)` : ""}.`,
    action: {
      label: item.actionHint ?? defaultActionLabel(domain),
      href: dest.href,
      tab: dest.tab,
    },
    destination: dest,
    createdAt: generatedAt,
    priority: item.priority,
    source: "investigation",
  };
}

/** Adapt intelligence feed cards. */
export function findingsFromFeed(
  feed: IntelligenceFeedResponse | null | undefined,
  generatedAt: string,
): Finding[] {
  if (!feed) return [];
  const todayStamp = startOfLocalDayIso(generatedAt);
  const today = feed.feed.today.map((i) => feedInsightToFinding(i, todayStamp, true));
  const patterns = feed.feed.insights.map((i) => feedInsightToFinding(i, generatedAt, false));
  return [...today, ...patterns];
}

function startOfLocalDayIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function feedInsightToFinding(
  insight: IntelligenceInsight,
  generatedAt: string,
  isToday: boolean,
): Finding {
  const domain = domainFromCategory(insight.category, insight.type);
  const type = typeFromCategory(insight.category, insight.type);
  const sampleSize = insight.evidence?.n ?? 0;
  const level = insight.evidence?.level;
  const { strength, label } = confidenceFromSample(sampleSize, level);
  const dest = insight.action?.href
    ? { label: destinationFor(domain).label, href: insight.action.href }
    : destinationFor(domain);

  const comparison = insight.comparison
    ? {
        baselineLabel: insight.comparison.baseline,
        baselineValue: insight.comparison.baseline_value,
        subjectLabel: insight.comparison.subject,
        subjectValue: insight.comparison.subject_value,
      }
    : null;

  const primaryMetric =
    sampleSize > 0
      ? metric("sample", insight.evidence.label || "Evidence", insight.evidence.reason || `${sampleSize} trades`)
      : null;

  return {
    id: `feed:${insight.id}`,
    type: isToday && type === "PERFORMANCE" ? "PERFORMANCE" : type,
    title: insight.title,
    summary: insight.summary,
    domain,
    severity: severityFromFeed(insight.severity),
    confidenceStrength: strength,
    confidence: label,
    sampleSize,
    metric: primaryMetric,
    comparison,
    evidence: evidenceItems([
      ["Evidence", insight.evidence.label || insight.evidence.reason || "—"],
      ...(sampleSize ? ([["Sample", `${sampleSize} trades`]] as Array<[string, string]>) : []),
    ]),
    whyItMatters: insight.why,
    whySurfaced: insight.why,
    action: {
      label: insight.action?.label ?? defaultActionLabel(domain),
      href: dest.href,
    },
    destination: dest,
    createdAt: generatedAt,
    priority: insight.priority,
    source: "feed",
  };
}

/** Adapt Phase3 lab insight cards. */
export function findingsFromLab(
  lab: IntelligenceLabPayload | null | undefined,
  generatedAt: string,
): Finding[] {
  if (!lab?.insights?.length) return [];
  return lab.insights.map((card) => labCardToFinding(card, lab, generatedAt));
}

function labCardToFinding(
  card: IntelligenceInsightCard,
  lab: IntelligenceLabPayload,
  generatedAt: string,
): Finding {
  const domain = domainFromCategory(card.category);
  const type = typeFromCategory(card.category);
  const sampleSize = card.sample_size ?? lab.metadata.trades_analyzed ?? 0;
  const strength = strengthFromLabConfidence(card.confidence, sampleSize);
  const label = findingConfidenceLabel(strength, sampleSize);
  const dest = destinationFor(domain);

  const evidence = evidenceFromUnknown(card.evidence);

  return {
    id: `lab:${card.id}`,
    type,
    title: card.title,
    summary: card.finding,
    domain,
    severity: severityFromLab(card.severity),
    confidenceStrength: strength,
    confidence: label,
    sampleSize,
    metric: evidence[0] ? metric(evidence[0].label, evidence[0].label, evidence[0].value) : null,
    comparison: null,
    evidence,
    whyItMatters: card.finding,
    whySurfaced: `Surfaced from Intelligence Lab detectors (${card.id}) on ${sampleSize} trades.`,
    action: { label: defaultActionLabel(domain), href: dest.href, tab: dest.tab },
    destination: dest,
    createdAt: generatedAt,
    priority: card.priority,
    source: "lab",
  };
}

function evidenceFromUnknown(raw: Record<string, unknown>): FindingEvidenceItem[] {
  const items: FindingEvidenceItem[] = [];
  for (const [key, value] of Object.entries(raw)) {
    if (value == null || typeof value === "object") continue;
    items.push({ label: key.replace(/_/g, " "), value: String(value) });
    if (items.length >= 6) break;
  }
  return items;
}

/**
 * Direct detectors over dashboard + lab metrics.
 * Only emit when investigation/feed may miss structured evidence strips.
 */
export function findingsFromDetectors(
  data: AnalyticsDashboard,
  lab: IntelligenceLabPayload | null | undefined,
  generatedAt: string,
  periodLabel?: string,
): Finding[] {
  const out: Finding[] = [];
  const period = periodLabel ? ` during ${periodLabel}` : "";

  // Strongest session edge with comparison strip
  const sessions = getSessionPerformance(data);
  const best = topGroupByExpectancy(sessions, MIN_GROUP_TRADES);
  const worst = bottomGroupByExpectancy(sessions, MIN_GROUP_TRADES);
  if (best && worst && best.key !== worst.key && best.expectancy != null && worst.expectancy != null) {
    const gap = best.expectancy - worst.expectancy;
    if (gap >= SESSION_GAP_R) {
      const sampleSize = best.trades + worst.trades;
      const { strength, label } = confidenceFromSample(sampleSize);
      const dest = destinationFor("edge");
      out.push({
        id: "detector:session-edge",
        type: best.expectancy > 0 ? "OPPORTUNITY" : "EDGE",
        title: `${best.label} is your strongest session`,
        summary: `${best.label} expectancy (${signed(best.expectancy)}R) leads ${worst.label} (${signed(worst.expectancy)}R)${period}.`,
        domain: "edge",
        severity: worst.expectancy < 0 ? "IMPORTANT" : "INFO",
        confidenceStrength: strength,
        confidence: label,
        sampleSize,
        metric: metric("expectancy_r", "Expectancy", `${signed(best.expectancy)}R`, toneR(best.expectancy)),
        comparison: {
          baselineLabel: worst.label,
          baselineValue: `${signed(worst.expectancy)}R`,
          subjectLabel: best.label,
          subjectValue: `${signed(best.expectancy)}R`,
          delta: `${signed(gap)}R`,
        },
        evidence: evidenceItems([
          ["Expectancy", `${signed(best.expectancy)}R`, toneR(best.expectancy)],
          ["Trades", String(best.trades)],
          ["Win rate", best.winRate != null ? `${num(best.winRate, 0)}%` : "—"],
          [`${worst.label}`, `${signed(worst.expectancy)}R`, toneR(worst.expectancy)],
        ]),
        whyItMatters:
          best.expectancy > 0
            ? `Most of your positive session expectancy${period} is currently concentrated in ${best.label}.`
            : `Session results diverge enough to review where you trade${period}.`,
        whySurfaced: `TraderOS surfaced this because ${best.label} expectancy is ${signed(gap)}R higher than ${worst.label} over ${sampleSize} combined trades.`,
        action: { label: "Explore this edge →", href: dest.href, tab: dest.tab },
        destination: dest,
        createdAt: generatedAt,
        priority: 78,
        source: "detector",
      });
    }
  }

  // Risk escalation after losses from lab behaviour block
  const revenge = lab?.behaviour?.revenge_trading;
  if (revenge) {
    const pct = revenge.risk_multiplier_after_loss_pct != null ? Number(revenge.risk_multiplier_after_loss_pct) : null;
    const postLossN = lab.insights.find((i) => i.id === "risk_after_loss_increase")?.sample_size ?? 0;

    if (pct != null && !Number.isNaN(pct) && pct > RISK_AFTER_LOSS_PCT && postLossN >= MIN_POST_LOSS_TRADES) {
      const { strength, label } = confidenceFromSample(postLossN);
      const dest = destinationFor("behaviour");
      out.push({
        id: "detector:risk-after-loss",
        type: "BEHAVIOUR",
        title: "Risk increases after losses",
        summary: `Average risk was ${num(pct, 0)}% higher following losing trades.`,
        domain: "behaviour",
        severity: pct >= 35 ? "IMPORTANT" : "WATCH",
        confidenceStrength: strength,
        confidence: label,
        sampleSize: postLossN,
        metric: metric("risk_change", "After loss", `+${num(pct, 0)}%`, "neg"),
        comparison: {
          baselineLabel: "Baseline risk",
          baselineValue: revenge.baseline_risk ?? "—",
          subjectLabel: "After loss",
          subjectValue: revenge.average_risk_after_loss ?? "—",
          delta: `+${num(pct, 0)}%`,
        },
        evidence: evidenceItems([
          ["Baseline risk", revenge.baseline_risk ?? "—"],
          ["After loss", revenge.average_risk_after_loss ?? "—"],
          ["Change", `+${num(pct, 0)}%`, "neg"],
          ["Sequences", `${postLossN} trades`],
        ]),
        whyItMatters: "Risk expansion after losses can compound drawdowns — worth reviewing sizing rules.",
        whySurfaced: `TraderOS surfaced this because risk after losses is ${num(pct, 0)}% above baseline across ${postLossN} post-loss trades.`,
        action: { label: defaultActionLabel("behaviour"), href: dest.href, tab: dest.tab },
        destination: dest,
        createdAt: generatedAt,
        priority: 82,
        source: "detector",
      });
    }
  }

  // Performance snapshot when expectancy is clearly signed with sample
  const perf = getPerformanceMetrics(data);
  if (perf.trades >= MIN_GROUP_TRADES && perf.expectancyR != null) {
    // Only emit a soft performance note when nothing else — engine will dedupe heavily.
    // Skip if near zero.
    if (Math.abs(perf.expectancyR) >= 0.15) {
      const { strength, label } = confidenceFromSample(perf.trades);
      const dest = destinationFor("performance");
      const positive = perf.expectancyR > 0;
      out.push({
        id: "detector:period-expectancy",
        type: "PERFORMANCE",
        title: positive ? "Positive expectancy in this period" : "Negative expectancy in this period",
        summary: `Overall expectancy is ${signed(perf.expectancyR)}R across ${perf.trades} trades${period}.`,
        domain: "performance",
        severity: positive ? "INFO" : "WATCH",
        confidenceStrength: strength,
        confidence: label,
        sampleSize: perf.trades,
        metric: metric("expectancy_r", "Expectancy", `${signed(perf.expectancyR)}R`, toneR(perf.expectancyR)),
        comparison: null,
        evidence: evidenceItems([
          ["Expectancy", `${signed(perf.expectancyR)}R`, toneR(perf.expectancyR)],
          ["Win rate", perf.winRate != null ? `${num(perf.winRate, 0)}%` : "—"],
          ["Trades", String(perf.trades)],
          ["Net P&L", signed(perf.netPnl)],
        ]),
        whyItMatters: positive
          ? "Your filtered sample is currently producing positive expected value per trade."
          : "Your filtered sample is currently producing negative expected value per trade.",
        whySurfaced: `TraderOS surfaced this because period expectancy is ${signed(perf.expectancyR)}R on ${perf.trades} closed trades.`,
        action: { label: defaultActionLabel("performance"), href: dest.href, tab: dest.tab },
        destination: dest,
        createdAt: generatedAt,
        priority: 35,
        source: "detector",
      });
    }
  }

  return out;
}
