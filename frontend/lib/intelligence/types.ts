import type { AnalyticsPageId, InsightStrength } from "@/lib/analytics/types";

/** Finding taxonomy — attention domains, not chart sections. */
export type FindingType =
  | "EDGE"
  | "BEHAVIOUR"
  | "EXECUTION"
  | "RISK"
  | "PERFORMANCE"
  | "CONSISTENCY"
  | "OPPORTUNITY"
  | "WARNING";

/** Honest urgency. Prefer INFO/WATCH; use CRITICAL sparingly. */
export type FindingSeverity = "INFO" | "WATCH" | "IMPORTANT" | "CRITICAL";

/** Deterministic evidence quality — never AI-invented. */
export type FindingConfidenceLabel =
  | "Insufficient evidence"
  | "Early signal"
  | "Emerging pattern"
  | "Supported"
  | "Strong evidence";

export type FindingDomain =
  | "edge"
  | "behaviour"
  | "execution"
  | "risk"
  | "performance"
  | "consistency"
  | "calendar"
  | "quant"
  | "general";

export type FindingMetric = {
  key: string;
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
};

export type FindingComparison = {
  baselineLabel: string;
  baselineValue: string;
  subjectLabel: string;
  subjectValue: string;
  /** Human-readable delta when known, e.g. "+1.03R". */
  delta?: string;
};

export type FindingEvidenceItem = {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
};

export type FindingAction = {
  label: string;
  href?: string;
  /** Analytics tab when href is /analytics?tab=… */
  tab?: AnalyticsPageId;
};

export type FindingDestination = {
  label: string;
  href: string;
  tab?: AnalyticsPageId;
};

/**
 * Standardized intelligence finding.
 * Numbers must originate from deterministic analytics — never fabricate.
 */
export type Finding = {
  id: string;
  type: FindingType;
  title: string;
  summary: string;
  domain: FindingDomain;
  severity: FindingSeverity;
  /** Internal strength used for prioritization. */
  confidenceStrength: InsightStrength;
  /** Trader-facing confidence label. */
  confidence: FindingConfidenceLabel;
  sampleSize: number;
  metric: FindingMetric | null;
  comparison: FindingComparison | null;
  evidence: FindingEvidenceItem[];
  whyItMatters: string;
  /** Deterministic "Why am I seeing this?" copy from real metrics. */
  whySurfaced: string;
  action: FindingAction;
  destination: FindingDestination;
  createdAt: string;
  /** Opaque score after prioritization (higher = more important). */
  priority: number;
  /** Source system for debugging / dedupe. */
  source: "investigation" | "feed" | "lab" | "detector";
};

export type IntelligenceMaturity = "empty" | "early" | "mature";

export type IntelligenceEngineInput = {
  /** Closed trades in the active filter window. */
  tradeCount: number;
  /** ISO timestamp for createdAt when sources lack dates. */
  generatedAt?: string;
  /** Period label for whySurfaced copy, e.g. "Last 30 days". */
  periodLabel?: string;
};

export type IntelligenceEngineResult = {
  findings: Finding[];
  primary: Finding | null;
  /** Top findings excluding primary (typically 3–5). */
  attention: Finding[];
  /** Investigation-oriented subset (actionable destinations). */
  queue: Finding[];
  /** Chronological / feed-oriented list. */
  recent: Finding[];
  tradeCount: number;
  maturity: IntelligenceMaturity;
  generatedAt: string;
  notableCount: number;
};
