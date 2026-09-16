/**
 * Trader-friendly Home copy. Technical language belongs in Analytics / Quant Lab.
 */

export function homeSampleMessage(nTrades: number): string {
  if (nTrades <= 0) {
    return "Start journaling trades to unlock your performance picture.";
  }
  if (nTrades === 1) {
    return "Only 1 trade so far — still early.";
  }
  if (nTrades < 10) {
    return `Only ${nTrades} trades so far — still early.`;
  }
  if (nTrades < 30) {
    return `You're building a useful trading sample (${nTrades} trades).`;
  }
  return `Enough history is building to reveal patterns (${nTrades} trades).`;
}

/** Map backend sample_note / n into Home language. Never invent trade counts. */
export function homeConfidenceLine(nTrades: number, _sampleNote?: string | null): string {
  return homeSampleMessage(nTrades);
}
