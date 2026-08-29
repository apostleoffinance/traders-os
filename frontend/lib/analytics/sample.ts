/** Suggested minimum closed trades before comparative analytics are shown as reliable. */
export const ANALYTICS_MIN_SAMPLE = 20;

export function isInsufficientSample(n: number, threshold = ANALYTICS_MIN_SAMPLE): boolean {
  return n < threshold;
}

export function sampleLabel(n: number): string {
  return `${n} trade${n === 1 ? "" : "s"}`;
}

export function insufficientSampleMessage(
  n: number,
  context = "this analysis",
  threshold = ANALYTICS_MIN_SAMPLE,
): string {
  if (n >= threshold) return "";
  return `We need more closed trades before ${context} becomes useful. Current sample: ${sampleLabel(n)}.`;
}
