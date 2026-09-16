/**
 * TraderOS Intelligence — deterministic finding layer.
 *
 * Architecture:
 *   trades → analytics → metrics → detectors → findings → (AI explain) → investigate
 *
 * Numbers always come from existing analytics; this module only adapts and ranks.
 */

export type {
  Finding,
  FindingType,
  FindingSeverity,
  FindingConfidenceLabel,
  FindingDomain,
  FindingMetric,
  FindingComparison,
  FindingEvidenceItem,
  FindingAction,
  FindingDestination,
  IntelligenceMaturity,
  IntelligenceEngineInput,
  IntelligenceEngineResult,
} from "./types";

export type {
  InsightEvidence,
  InsightComparison,
  InsightAction,
  IntelligenceInsight,
  IntelligenceFeedResponse,
} from "./feed";

export { buildIntelligenceFindings } from "./engine";
export type { BuildIntelligenceFindingsArgs } from "./engine";

export {
  findingsFromDetectors,
  findingsFromFeed,
  findingsFromInvestigation,
  findingsFromLab,
} from "./detectors";

export { prioritizeFindings, dedupeFindings, scoreFinding } from "./prioritization";
export {
  confidenceFromSample,
  confidenceText,
  intelligenceActivityStatus,
  findingConfidenceLabel,
  severityFromFeed,
  severityFromLab,
  severityFromInvestigation,
} from "./evidence";
export {
  destinationFor,
  defaultActionLabel,
  domainFromCategory,
  typeFromCategory,
} from "./destinations";
export { buildExplanationContext, buildExplanationPrompt, buildExplanationRequest } from "./explanations";
export type { FindingExplanationContext, FindingExplanationRequest } from "./explanations";
export {
  MIN_GROUP_TRADES,
  MIN_MATURE_TRADES,
  ATTENTION_LIMIT,
  QUEUE_LIMIT,
  RECENT_LIMIT,
} from "./thresholds";

export { filterPatchFromFinding } from "./filter-patch";
