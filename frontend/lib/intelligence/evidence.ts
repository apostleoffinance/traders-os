import type { InsightStrength } from "@/lib/analytics/types";
import { classifyConfidence, confidenceLabel as analyticsConfidenceLabel } from "@/lib/analytics/confidence";
import { ANALYTICS_MIN_SAMPLE } from "@/lib/analytics/sample";
import type { FindingConfidenceLabel, FindingSeverity } from "./types";

/** Map sample size (+ optional backend evidence level) to honesty labels. */
export function confidenceFromSample(
  sampleSize: number,
  evidenceLevel?: string,
): { strength: InsightStrength; label: FindingConfidenceLabel } {
  const level = normalizeEvidenceLevel(evidenceLevel);
  const strength = classifyConfidence(sampleSize, level);
  return { strength, label: findingConfidenceLabel(strength, sampleSize) };
}

function normalizeEvidenceLevel(
  raw?: string,
): "INSUFFICIENT" | "LOW" | "MODERATE" | "HIGH" | undefined {
  if (!raw) return undefined;
  const s = raw.toUpperCase();
  if (s === "HIGH" || s === "MODERATE" || s === "LOW" || s === "INSUFFICIENT") return s;
  return undefined;
}

/**
 * Product labels for Intelligence.
 * Does not claim statistical significance — sample-aware only.
 */
export function findingConfidenceLabel(
  strength: InsightStrength,
  sampleSize: number,
): FindingConfidenceLabel {
  switch (strength) {
    case "insufficient":
      return "Insufficient evidence";
    case "early":
      return sampleSize >= 10 ? "Emerging pattern" : "Early signal";
    case "moderate":
      return sampleSize >= ANALYTICS_MIN_SAMPLE ? "Supported" : "Emerging pattern";
    case "strong":
      return "Strong evidence";
    default:
      return "Early signal";
  }
}

export function confidenceText(label: FindingConfidenceLabel, sampleSize: number): string {
  const unit = sampleSize === 1 ? "trade" : "trades";
  // Trader-facing display — keep internal labels; soften harsh wording on primary UI.
  const friendly =
    label === "Insufficient evidence"
      ? "Early observation"
      : label === "Strong evidence"
        ? "Stronger history"
        : label === "Early signal"
          ? "Early observation"
          : label === "Emerging pattern"
            ? "Pattern we're seeing"
            : label === "Supported"
              ? "Repeated pattern"
              : label;
  return `${friendly} · ${sampleSize} ${unit}`;
}

/** Activity line for Intelligence status (replaces sample-size jargon). */
export function intelligenceActivityStatus(tradeCount: number, maturity: "empty" | "early" | "mature"): string {
  if (tradeCount <= 0 || maturity === "empty") return "No closed trades yet";
  const unit = tradeCount === 1 ? "trade" : "trades";
  if (maturity === "early") {
    if (tradeCount < 5) return `${tradeCount} ${unit} analyzed · Still early`;
    return `${tradeCount} ${unit} analyzed · Patterns starting to emerge`;
  }
  return `${tradeCount} ${unit} analyzed · Stronger history available`;
}

/** Bridge analytics prose labels when needed. */
export function analyticsStrengthLabel(strength: InsightStrength): string {
  return analyticsConfidenceLabel(strength);
}

export function severityFromFeed(raw: string): FindingSeverity {
  const s = raw.toLowerCase();
  if (s === "danger" || s === "critical" || s === "halt") return "CRITICAL";
  if (s === "warn" || s === "warning") return "IMPORTANT";
  if (s === "positive" || s === "opportunity") return "INFO";
  if (s === "watch") return "WATCH";
  return "INFO";
}

export function severityFromLab(raw: string): FindingSeverity {
  const s = raw.toLowerCase();
  if (s === "warning" || s === "warn") return "IMPORTANT";
  if (s === "opportunity") return "INFO";
  if (s === "observation") return "WATCH";
  return "INFO";
}

export function severityFromInvestigation(raw: "positive" | "warn" | "info"): FindingSeverity {
  if (raw === "warn") return "IMPORTANT";
  if (raw === "positive") return "INFO";
  return "INFO";
}

/** Parse backend confidence strings like "MODERATE" / "moderate". */
export function strengthFromLabConfidence(
  raw: string | undefined,
  sampleSize: number,
): InsightStrength {
  if (!raw) return classifyConfidence(sampleSize);
  const s = raw.toLowerCase();
  if (s.includes("insuff") || s === "low" || s === "none") return classifyConfidence(sampleSize);
  if (s.includes("strong") || s.includes("high")) return sampleSize >= 50 ? "strong" : "moderate";
  if (s.includes("moderat") || s.includes("support")) return "moderate";
  if (s.includes("early") || s.includes("emerg")) return "early";
  return classifyConfidence(sampleSize);
}
