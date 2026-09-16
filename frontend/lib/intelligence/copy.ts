/**
 * Concise trader-facing copy templates for Intelligence signals.
 * Values must be passed in from deterministic findings — never invent numbers.
 */

export function observedResultCopy(subject: string, result: string, n: number): string {
  const unit = n === 1 ? "trade" : "trades";
  return `${subject} produced ${result} across ${n} ${unit}.`;
}

export function earlyObservationCopy(subject: string, result: string, n: number): string {
  const unit = n === 1 ? "trade has" : "trades have";
  return `${subject} is ${result} so far, but only ${n} ${unit} been recorded.`;
}

export function repeatedPatternCopy(subject: string, result: string, n: number): string {
  return `${subject} has produced ${result} across ${n} trades.`;
}

export function moreTradesNeededCopy(n: number): string {
  if (n <= 0) return "More trades needed before patterns can emerge.";
  return `${n} trade${n === 1 ? "" : "s"} analyzed — more trades needed to establish a pattern.`;
}

export function whySurfacedShort(subject: string, result: string): string {
  return `TraderOS is showing this because ${subject} produced ${result}.`;
}
