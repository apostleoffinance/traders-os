/** Deterministic thresholds for intelligence detectors. Align with investigation + feed engines. */

import { ANALYTICS_MIN_SAMPLE } from "@/lib/analytics/sample";

/** Minimum trades before comparative edge claims. */
export const MIN_GROUP_TRADES = 5;

/** Minimum trades before treating the book as more than early signals. */
export const MIN_MATURE_TRADES = ANALYTICS_MIN_SAMPLE;

/** Session expectancy gap (R) that warrants attention. */
export const SESSION_GAP_R = 0.3;

/** Exit capture % below which early-exit finding fires. */
export const EXIT_CAPTURE_WARN_PCT = 45;

/** Minimum coverage for MFE capture findings. */
export const MIN_EXIT_COVERAGE = 10;

/** Cost drag % that warrants a finding. */
export const COST_DRAG_WARN_PCT = 12;

/** Fragile profit factor ceiling while net P&L is positive. */
export const FRAGILE_PF_MAX = 1.15;

/** Risk-after-loss % increase (from lab) that warrants a finding. */
export const RISK_AFTER_LOSS_PCT = 15;

/** Minimum post-loss trades for risk-escalation finding. */
export const MIN_POST_LOSS_TRADES = 5;

/** Attention grid size (excluding primary). */
export const ATTENTION_LIMIT = 5;

/** Investigation queue size. */
export const QUEUE_LIMIT = 6;

/** Recent feed size. */
export const RECENT_LIMIT = 12;

/** Soft weight caps used by prioritization. */
export const PRIORITY = {
  base: 50,
  criticalBoost: 40,
  importantBoost: 25,
  watchBoost: 12,
  sampleStrong: 18,
  sampleSupported: 10,
  sampleEarly: -8,
  sampleInsufficient: -35,
  magnitudeUnit: 8,
  magnitudeCap: 24,
  opportunityTrim: -6,
} as const;
