/**
 * Lightweight intelligence engine tests — run with:
 *   npx tsx lib/intelligence/engine.test.ts
 */
import assert from "node:assert/strict";
import { buildIntelligenceFindings } from "./engine";
import { confidenceFromSample, confidenceText } from "./evidence";
import { dedupeFindings, prioritizeFindings } from "./prioritization";
import type { Finding } from "./types";
import type { AnalyticsDashboard } from "../analytics";

assert.equal(confidenceFromSample(4).label, "Insufficient evidence");
assert.equal(confidenceFromSample(12).label, "Emerging pattern");
assert.equal(confidenceFromSample(25).label, "Supported");
assert.equal(confidenceFromSample(60, "HIGH").label, "Strong evidence");
assert.equal(confidenceText("Supported", 82), "Supported · 82 trades");

function stubFinding(partial: Partial<Finding> & Pick<Finding, "id" | "title">): Finding {
  return {
    type: "EDGE",
    summary: "test",
    domain: "edge",
    severity: "INFO",
    confidenceStrength: "moderate",
    confidence: "Supported",
    sampleSize: 40,
    metric: null,
    comparison: null,
    evidence: [],
    whyItMatters: "why",
    whySurfaced: "surfaced",
    action: { label: "Investigate →", href: "/analytics?tab=edge" },
    destination: { label: "Edge Lab", href: "/analytics?tab=edge", tab: "edge" },
    createdAt: "2026-01-01T00:00:00.000Z",
    priority: 50,
    source: "detector",
    ...partial,
  };
}

const tiny = stubFinding({
  id: "tiny-edge",
  title: "Huge on 4 trades",
  sampleSize: 4,
  confidenceStrength: "insufficient",
  confidence: "Insufficient evidence",
  severity: "IMPORTANT",
  priority: 90,
});
const solid = stubFinding({
  id: "solid-edge",
  title: "Modest on 150 trades",
  sampleSize: 150,
  confidenceStrength: "strong",
  confidence: "Strong evidence",
  severity: "WATCH",
  priority: 55,
});

const ranked = prioritizeFindings([tiny, solid]);
assert.equal(ranked[0].id, "solid-edge", "supported sample should outrank thin important spike");

const duped = dedupeFindings([
  stubFinding({ id: "inv:session_gap", title: "Session A", source: "investigation", priority: 70, sampleSize: 40 }),
  stubFinding({ id: "detector:session-edge", title: "Session B", source: "detector", priority: 78, sampleSize: 82 }),
]);
assert.equal(duped.length, 1);
assert.equal(duped[0].id, "detector:session-edge");

const empty = buildIntelligenceFindings({
  dashboard: null,
  tradeCount: 0,
  generatedAt: "2026-01-01T00:00:00.000Z",
});
assert.equal(empty.maturity, "empty");
assert.equal(empty.primary, null);

const earlyDash = {
  overview: {
    n_trades: 8,
    net_pnl: "100",
    total_r: "2",
    win_rate: "50",
    profit_factor: "1.2",
    expectancy_r: "0.25",
    average_r: "0.25",
    max_drawdown: "-50",
    current_drawdown: "-10",
  },
  sessions: [
    { key: "london", label: "London", n: 5, net_pnl: "200", win_rate: "60", profit_factor: "1.5", expectancy_r: "0.5", average_r: "0.5" },
    { key: "ny", label: "NY", n: 3, net_pnl: "-100", win_rate: "30", profit_factor: "0.7", expectancy_r: "-0.4", average_r: "-0.4" },
  ],
  setups: [],
  consistency: { trading_days: 4 },
  rolling_expectancy: [],
  lab: null,
} as unknown as AnalyticsDashboard;

const early = buildIntelligenceFindings({
  dashboard: earlyDash,
  tradeCount: 8,
  generatedAt: "2026-01-01T00:00:00.000Z",
  periodLabel: "Last 30 days",
});
assert.equal(early.maturity, "early");
assert.ok(early.findings.length >= 1);

console.log("intelligence engine tests passed");
