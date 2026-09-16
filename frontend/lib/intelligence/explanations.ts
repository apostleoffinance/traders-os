import { confidenceText } from "./evidence";
import type { Finding } from "./types";

/**
 * Structured context for AI explanation (Phase 7).
 * AI must explain these facts — never invent quantitative values.
 */
export type FindingExplanationContext = {
  findingId: string;
  title: string;
  summary: string;
  domain: string;
  severity: string;
  confidence: string;
  sampleSize: number;
  factLines: string[];
  whyItMatters: string;
  whySurfaced: string;
  investigationHint: string;
  /** Explicit non-negotiable instructions for the model. */
  guardrails: string[];
};

export function buildExplanationContext(finding: Finding): FindingExplanationContext {
  const factLines: string[] = [];
  if (finding.metric) {
    factLines.push(`${finding.metric.label}: ${finding.metric.value}`);
  }
  for (const e of finding.evidence) {
    factLines.push(`${e.label}: ${e.value}`);
  }
  if (finding.comparison) {
    factLines.push(
      `Comparison — ${finding.comparison.subjectLabel}: ${finding.comparison.subjectValue} vs ${finding.comparison.baselineLabel}: ${finding.comparison.baselineValue}` +
        (finding.comparison.delta ? ` (Δ ${finding.comparison.delta})` : ""),
    );
  }
  factLines.push(confidenceText(finding.confidence, finding.sampleSize));

  return {
    findingId: finding.id,
    title: finding.title,
    summary: finding.summary,
    domain: finding.domain,
    severity: finding.severity,
    confidence: finding.confidence,
    sampleSize: finding.sampleSize,
    factLines,
    whyItMatters: finding.whyItMatters,
    whySurfaced: finding.whySurfaced,
    investigationHint: finding.action.label,
    guardrails: [
      "Explain only the deterministic facts provided.",
      "Do not invent P&L, percentages, probabilities, trade counts, confidence, or significance.",
      "Do not give trade signals (no BUY/SELL).",
      "Distinguish fact vs interpretation vs what to investigate next.",
      "Use trader-friendly language.",
    ],
  };
}

/** POST body for /api/ai/accounts/{id}/finding-explanation */
export type FindingExplanationRequest = {
  finding_id: string;
  title: string;
  summary: string;
  domain: string;
  severity: string;
  confidence: string;
  sample_size: number;
  fact_lines: string[];
  why_it_matters: string;
  why_surfaced: string;
  investigation_hint: string;
  period_label?: string | null;
};

export function buildExplanationRequest(
  finding: Finding,
  periodLabel?: string | null,
): FindingExplanationRequest {
  const ctx = buildExplanationContext(finding);
  return {
    finding_id: ctx.findingId,
    title: ctx.title,
    summary: ctx.summary,
    domain: ctx.domain,
    severity: ctx.severity,
    confidence: ctx.confidence,
    sample_size: ctx.sampleSize,
    fact_lines: ctx.factLines,
    why_it_matters: ctx.whyItMatters,
    why_surfaced: ctx.whySurfaced,
    investigation_hint: ctx.investigationHint,
    period_label: periodLabel ?? null,
  };
}

/** Prompt body for an explanation endpoint — facts only. */
export function buildExplanationPrompt(finding: Finding): string {
  const ctx = buildExplanationContext(finding);
  return [
    "You are explaining a TraderOS intelligence finding.",
    "",
    "FINDING",
    ctx.title,
    ctx.summary,
    "",
    "FACTS (authoritative — do not change numbers)",
    ...ctx.factLines.map((l) => `- ${l}`),
    "",
    "WHY IT MATTERS",
    ctx.whyItMatters,
    "",
    "WHY SURFACED",
    ctx.whySurfaced,
    "",
    "Respond with: (1) What this means, (2) Possible interpretation, (3) What to investigate.",
    "Guardrails:",
    ...ctx.guardrails.map((g) => `- ${g}`),
  ].join("\n");
}
