import type { Evidence } from "@/lib/analytics";
import type { InsightStrength } from "@/lib/analytics/types";
import { ANALYTICS_MIN_SAMPLE } from "@/lib/analytics/sample";

const STRENGTH_LABELS: Record<InsightStrength, string> = {
  insufficient: "Insufficient sample",
  early: "Early signal",
  moderate: "Developing evidence",
  strong: "Strong evidence",
};

/** Map sample size and backend evidence level to trader-friendly confidence. */
export function classifyConfidence(
  sampleSize: number,
  evidenceLevel?: Evidence["level"],
  minimumSample = ANALYTICS_MIN_SAMPLE,
): InsightStrength {
  if (sampleSize < 5) return "insufficient";
  if (sampleSize < minimumSample) return "early";
  if (evidenceLevel === "HIGH" || sampleSize >= 50) return "strong";
  if (evidenceLevel === "MODERATE" || sampleSize >= minimumSample) return "moderate";
  if (evidenceLevel === "LOW") return "early";
  return "moderate";
}

export function confidenceLabel(strength: InsightStrength): string {
  return STRENGTH_LABELS[strength];
}

export function confidenceFromEvidence(evidence?: Evidence, fallbackN = 0): InsightStrength {
  if (!evidence) return classifyConfidence(fallbackN);
  return classifyConfidence(evidence.n || fallbackN, evidence.level);
}
