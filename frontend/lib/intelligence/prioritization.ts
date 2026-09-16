import type { Finding, FindingSeverity } from "./types";
import { PRIORITY } from "./thresholds";

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  CRITICAL: 4,
  IMPORTANT: 3,
  WATCH: 2,
  INFO: 1,
};

/**
 * Transparent prioritization:
 * score = basePriority
 *   + severity boost
 *   + sample/confidence adjustment
 *   + capped magnitude bonus
 *   − opportunity trim for soft positive edges when warnings exist
 *
 * A large effect on 4 trades cannot outrank a supported pattern on 150 trades.
 */
export function scoreFinding(
  finding: Finding,
  opts?: { magnitude?: number; preferWarnings?: boolean },
): number {
  let score = finding.priority || PRIORITY.base;

  switch (finding.severity) {
    case "CRITICAL":
      score += PRIORITY.criticalBoost;
      break;
    case "IMPORTANT":
      score += PRIORITY.importantBoost;
      break;
    case "WATCH":
      score += PRIORITY.watchBoost;
      break;
    default:
      break;
  }

  switch (finding.confidenceStrength) {
    case "strong":
      score += PRIORITY.sampleStrong;
      break;
    case "moderate":
      score += PRIORITY.sampleSupported;
      break;
    case "early":
      score += PRIORITY.sampleEarly;
      break;
    case "insufficient":
      score += PRIORITY.sampleInsufficient;
      break;
  }

  const mag = opts?.magnitude;
  if (mag != null && Number.isFinite(mag)) {
    score += Math.min(PRIORITY.magnitudeCap, Math.abs(mag) * PRIORITY.magnitudeUnit);
  }

  if (opts?.preferWarnings && (finding.type === "OPPORTUNITY" || finding.severity === "INFO")) {
    score += PRIORITY.opportunityTrim;
  }

  return score;
}

export function prioritizeFindings(findings: Finding[]): Finding[] {
  const hasWarning = findings.some(
    (f) => f.severity === "IMPORTANT" || f.severity === "CRITICAL" || f.type === "WARNING",
  );

  return [...findings]
    .map((f) => ({
      ...f,
      priority: scoreFinding(f, { preferWarnings: hasWarning }),
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (SEVERITY_ORDER[b.severity] !== SEVERITY_ORDER[a.severity]) {
        return SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
      }
      return b.sampleSize - a.sampleSize;
    });
}

/** Stable dedupe: prefer higher score, then larger sample. */
export function dedupeFindings(findings: Finding[]): Finding[] {
  const byKey = new Map<string, Finding>();
  for (const f of findings) {
    const key = normalizeDedupeKey(f);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, f);
      continue;
    }
    const prefer =
      f.priority > prev.priority ||
      (f.priority === prev.priority && f.sampleSize > prev.sampleSize) ||
      (f.priority === prev.priority && f.sampleSize === prev.sampleSize && sourceRank(f) > sourceRank(prev));
    if (prefer) byKey.set(key, f);
  }
  return [...byKey.values()];
}

function sourceRank(f: Finding): number {
  // Prefer richer structured detectors / investigation over raw feed noise.
  switch (f.source) {
    case "detector":
      return 4;
    case "investigation":
      return 3;
    case "lab":
      return 2;
    case "feed":
      return 1;
    default:
      return 0;
  }
}

function normalizeDedupeKey(f: Finding): string {
  // Collapse overlapping session/exit/risk stories from multiple engines.
  const id = f.id.toLowerCase();
  if (id.includes("session") || id.includes("session_gap") || id.includes("session-compare")) {
    return "theme:session-edge";
  }
  if (id.includes("exit") || id.includes("mfe") || id.includes("capture")) return "theme:exit-efficiency";
  if (id.includes("risk_after") || id.includes("risk-escalation") || id.includes("after-loss") || id.includes("after_loss")) {
    return "theme:risk-after-loss";
  }
  if (id.includes("overtrad") || id.includes("frequency")) return "theme:overtrading";
  if (id.includes("drawdown")) return "theme:drawdown";
  if (id.includes("cost")) return "theme:cost-drag";
  if (id.includes("sample") || id.includes("insufficient")) return "theme:sample-size";
  if (id.includes("strongest_instrument") || id.includes("instrument")) return `theme:instrument:${f.title}`;
  if (id.includes("playbook") || id.includes("setup")) return `theme:setup:${f.title}`;
  return `id:${f.id}`;
}
