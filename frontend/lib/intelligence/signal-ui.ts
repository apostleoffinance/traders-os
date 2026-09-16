/**
 * Trader-facing signal UI mapping over deterministic Finding.
 * Does not recalculate metrics — presentation only.
 */

import type { Finding, FindingConfidenceLabel, FindingSeverity, FindingType } from "./types";

/** Visual status for signal cards (labels + borders — not color-only). */
export type SignalUiStatus = "positive" | "watch" | "observe" | "risk" | "info";

export type SignalConfidenceState = "early" | "developing" | "established";

export type SignalViewModel = {
  finding: Finding;
  status: SignalUiStatus;
  statusLabel: string;
  categoryLabel: string;
  confidenceState: SignalConfidenceState;
  confidenceLabel: string;
  sampleLabel: string;
  metricLine: string | null;
  summaryLine: string;
  ctaLabel: string;
};

export function signalStatusFromFinding(finding: Finding): SignalUiStatus {
  if (finding.severity === "CRITICAL" || finding.type === "RISK" || finding.type === "WARNING") {
    return "risk";
  }
  if (finding.severity === "IMPORTANT" || finding.severity === "WATCH") {
    return "watch";
  }
  if (finding.metric?.tone === "pos" || finding.type === "OPPORTUNITY" || finding.type === "EDGE") {
    if (finding.confidenceStrength === "insufficient" || finding.confidenceStrength === "early") {
      return "observe";
    }
    return "positive";
  }
  if (finding.metric?.tone === "neg") return "watch";
  if (finding.severity === "INFO" && finding.sampleSize < 5) return "observe";
  return "info";
}

export function signalStatusLabel(status: SignalUiStatus): string {
  switch (status) {
    case "positive":
      return "Positive observation";
    case "watch":
      return "Watch";
    case "observe":
      return "Observe";
    case "risk":
      return "Risk";
    case "info":
      return "Information";
  }
}

export function confidenceStateFromFinding(finding: Finding): SignalConfidenceState {
  switch (finding.confidenceStrength) {
    case "strong":
    case "moderate":
      return finding.sampleSize >= 20 ? "established" : "developing";
    case "early":
      return "developing";
    case "insufficient":
    default:
      return "early";
  }
}

export function friendlyConfidenceLabel(label: FindingConfidenceLabel): string {
  switch (label) {
    case "Insufficient evidence":
      return "Early observation";
    case "Early signal":
      return "Early observation";
    case "Emerging pattern":
      return "Pattern we're seeing";
    case "Supported":
      return "Repeated pattern";
    case "Strong evidence":
      return "Stronger history";
    default:
      return label;
  }
}

export function categoryLabel(type: FindingType | string): string {
  const map: Record<string, string> = {
    EDGE: "Edge",
    BEHAVIOUR: "Behaviour",
    EXECUTION: "Execution",
    RISK: "Risk",
    PERFORMANCE: "Performance",
    CONSISTENCY: "Consistency",
    OPPORTUNITY: "Opportunity",
    WARNING: "Warning",
  };
  return map[String(type)] ?? String(type).replace(/_/g, " ");
}

export function toSignalViewModel(finding: Finding): SignalViewModel {
  const status = signalStatusFromFinding(finding);
  const confidenceState = confidenceStateFromFinding(finding);
  const sampleLabel =
    finding.sampleSize > 0
      ? `${finding.sampleSize} trade${finding.sampleSize === 1 ? "" : "s"}`
      : "No trades yet";

  const evidenceBits = finding.evidence
    .slice(0, 2)
    .map((e) => e.value)
    .filter(Boolean);
  const support = [sampleLabel, ...evidenceBits].slice(0, 3).join(" · ");

  return {
    finding,
    status,
    statusLabel: signalStatusLabel(status),
    categoryLabel: categoryLabel(finding.type),
    confidenceState,
    confidenceLabel: friendlyConfidenceLabel(finding.confidence),
    sampleLabel,
    metricLine: finding.metric ? `${finding.metric.value}` : null,
    summaryLine: finding.summary || finding.whyItMatters,
    ctaLabel: finding.action.label || "Inspect",
  };
}

/** Severity → status for badge reuse without inventing urgency. */
export function severityToUiHint(severity: FindingSeverity): string {
  return severity.toLowerCase();
}

export function buildSignalList(primary: Finding | null, attention: Finding[]): Finding[] {
  const list: Finding[] = [];
  if (primary) list.push(primary);
  for (const f of attention) {
    if (!list.some((x) => x.id === f.id)) list.push(f);
  }
  return list.slice(0, 5);
}
