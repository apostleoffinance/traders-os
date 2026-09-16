import type { AnalyticsDashboard, IntelligenceLabPayload } from "@/lib/analytics";
import type { IntelligenceFeedResponse } from "./feed";
import {
  findingsFromDetectors,
  findingsFromFeed,
  findingsFromInvestigation,
  findingsFromLab,
} from "./detectors";
import { dedupeFindings, prioritizeFindings } from "./prioritization";
import { ATTENTION_LIMIT, MIN_MATURE_TRADES, QUEUE_LIMIT, RECENT_LIMIT } from "./thresholds";
import type {
  Finding,
  IntelligenceEngineInput,
  IntelligenceEngineResult,
  IntelligenceMaturity,
} from "./types";

export type BuildIntelligenceFindingsArgs = IntelligenceEngineInput & {
  dashboard: AnalyticsDashboard | null | undefined;
  feed?: IntelligenceFeedResponse | null;
  lab?: IntelligenceLabPayload | null;
};

/**
 * Compose existing deterministic sources into a ranked Finding set.
 * Does not recalculate analytics — adapters only.
 */
export function buildIntelligenceFindings(args: BuildIntelligenceFindingsArgs): IntelligenceEngineResult {
  const generatedAt = args.generatedAt ?? new Date().toISOString();
  const tradeCount =
    args.tradeCount ??
    args.dashboard?.overview.n_trades ??
    args.lab?.metadata.trades_analyzed ??
    0;

  if (!args.dashboard || tradeCount <= 0) {
    return emptyResult(tradeCount, generatedAt);
  }

  const raw: Finding[] = [
    ...findingsFromDetectors(args.dashboard, args.lab, generatedAt, args.periodLabel),
    ...findingsFromInvestigation(args.dashboard, generatedAt),
    ...findingsFromLab(args.lab, generatedAt),
    ...findingsFromFeed(args.feed, generatedAt),
  ];

  const ranked = prioritizeFindings(dedupeFindings(raw));
  const substantive = ranked.filter((f) => !isMetaSampleFinding(f));
  const usable = substantive.length ? substantive : ranked;

  const primary = pickPrimary(usable);
  const attention = usable.filter((f) => f.id !== primary?.id).slice(0, ATTENTION_LIMIT);
  const queue = buildQueue(usable).slice(0, QUEUE_LIMIT);
  const recent = buildRecent(usable, args.feed).slice(0, RECENT_LIMIT);

  return {
    findings: usable,
    primary,
    attention,
    queue,
    recent,
    tradeCount,
    maturity: maturityFor(tradeCount),
    generatedAt,
    notableCount: usable.filter((f) => !isMetaSampleFinding(f)).length,
  };
}

function emptyResult(tradeCount: number, generatedAt: string): IntelligenceEngineResult {
  return {
    findings: [],
    primary: null,
    attention: [],
    queue: [],
    recent: [],
    tradeCount,
    maturity: tradeCount <= 0 ? "empty" : maturityFor(tradeCount),
    generatedAt,
    notableCount: 0,
  };
}

function maturityFor(tradeCount: number): IntelligenceMaturity {
  if (tradeCount <= 0) return "empty";
  if (tradeCount < MIN_MATURE_TRADES) return "early";
  return "mature";
}

function isMetaSampleFinding(f: Finding): boolean {
  return f.id.includes("sample_size") || f.id.includes("insufficient_evidence");
}

function isPrimaryCandidate(f: Finding): boolean {
  if (isMetaSampleFinding(f)) return false;
  if (f.source === "feed" && f.id.includes("today-")) return false;
  return (
    f.severity === "CRITICAL" ||
    f.severity === "IMPORTANT" ||
    f.severity === "WATCH" ||
    f.type === "OPPORTUNITY" ||
    f.type === "EDGE" ||
    f.type === "BEHAVIOUR" ||
    f.type === "EXECUTION" ||
    f.type === "RISK" ||
    f.type === "WARNING" ||
    f.source === "detector" ||
    f.source === "investigation" ||
    f.source === "lab"
  );
}

function pickPrimary(findings: Finding[]): Finding | null {
  if (!findings.length) return null;
  return findings.find(isPrimaryCandidate) ?? findings[0] ?? null;
}

function buildQueue(findings: Finding[]): Finding[] {
  return findings.filter((f) => {
    if (isMetaSampleFinding(f)) return false;
    if (!f.destination.href) return false;
    // Prefer actionable warnings / domain investigations over soft performance notes
    if (f.severity === "CRITICAL" || f.severity === "IMPORTANT" || f.severity === "WATCH") return true;
    if (f.type === "EDGE" || f.type === "BEHAVIOUR" || f.type === "EXECUTION" || f.type === "RISK") {
      return true;
    }
    if (f.type === "WARNING" || f.type === "OPPORTUNITY") return true;
    return f.source === "investigation" || f.source === "detector";
  });
}

function buildRecent(findings: Finding[], feed?: IntelligenceFeedResponse | null): Finding[] {
  const todayIds = new Set(feed?.feed.today.map((i) => `feed:${i.id}`) ?? []);
  const feedIds = new Set(
    feed ? [...feed.feed.today, ...feed.feed.insights].map((i) => `feed:${i.id}`) : [],
  );
  const fromFeed = findings.filter((f) => feedIds.has(f.id));
  const rest = findings.filter((f) => !feedIds.has(f.id) && !isMetaSampleFinding(f));

  const sorted = [...fromFeed, ...rest].sort((a, b) => {
    const aToday = todayIds.has(a.id) ? 1 : 0;
    const bToday = todayIds.has(b.id) ? 1 : 0;
    if (bToday !== aToday) return bToday - aToday;
    const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (byDate !== 0) return byDate;
    return b.priority - a.priority;
  });

  return sorted;
}
