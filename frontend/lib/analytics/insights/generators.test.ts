/**
 * Lightweight insight generator tests — run with:
 *   npx tsx lib/analytics/insights/generators.test.ts
 */
import assert from "node:assert/strict";
import { classifyConfidence } from "../confidence";
import { generatePerformanceInsight, generateGroupedInsight } from "./generators";
import type { GroupPerformanceRow } from "../view-models";

assert.equal(classifyConfidence(4), "insufficient");
assert.equal(classifyConfidence(10), "early");
assert.equal(classifyConfidence(25), "moderate");
assert.equal(classifyConfidence(60, "HIGH"), "strong");

const smallInsight = generatePerformanceInsight({
  netPnl: 100,
  winRate: 55,
  profitFactor: 1.4,
  expectancyR: 0.3,
  trades: 4,
});
assert.equal(smallInsight.strength, "insufficient");

const solidInsight = generatePerformanceInsight({
  netPnl: 500,
  winRate: 58,
  profitFactor: 1.6,
  expectancyR: 0.4,
  trades: 60,
});
assert.notEqual(solidInsight.strength, "insufficient");
assert.ok(solidInsight.observation.length > 0);

const rows: GroupPerformanceRow[] = [
  { key: "EURUSD", label: "EURUSD", trades: 20, netPnl: 400, winRate: 60, profitFactor: 1.5, expectancy: 0.5, averageR: 0.5 },
  { key: "GBPUSD", label: "GBPUSD", trades: 15, netPnl: -200, winRate: 40, profitFactor: 0.8, expectancy: -0.3, averageR: -0.3 },
];
const grouped = generateGroupedInsight(rows, "instrument");
assert.ok(grouped);
assert.equal(grouped?.direction, "mixed");

console.log("analytics insight tests passed");
