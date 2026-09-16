import type { FilterState } from "@/lib/analytics";
import type { Finding } from "./types";

const SESSION_KEYS: Record<string, string> = {
  asia: "asia",
  london: "london",
  "new york": "new_york",
  ny: "new_york",
  new_york: "new_york",
  "london/ny": "london_ny_overlap",
  "london/ny overlap": "london_ny_overlap",
  london_ny_overlap: "london_ny_overlap",
  outside: "outside",
};

/**
 * Best-effort filter patch so related trades match the finding theme.
 * Returns empty object when we cannot infer a safe filter.
 */
export function filterPatchFromFinding(finding: Finding): Partial<FilterState> {
  const patch: Partial<FilterState> = {};
  const hay = `${finding.id} ${finding.title} ${finding.summary} ${finding.comparison?.subjectLabel ?? ""}`.toLowerCase();

  if (finding.domain === "edge" || finding.id.includes("session")) {
    const session = inferSession(hay, finding.comparison?.subjectLabel);
    if (session) patch.session = session;
  }

  if (finding.id.includes("instrument") || /strongest observed edge/i.test(finding.title)) {
    const symbol = inferSymbol(finding);
    if (symbol) patch.symbol = symbol;
  }

  if (finding.id.includes("weak_setup") || finding.id.includes("setup")) {
    // setup_id is UUID — do not guess from label
  }

  return patch;
}

function inferSession(hay: string, subjectLabel?: string): string | undefined {
  const candidates = [subjectLabel ?? "", hay];
  for (const raw of candidates) {
    const key = SESSION_KEYS[raw.trim().toLowerCase()];
    if (key) return key;
    for (const [label, session] of Object.entries(SESSION_KEYS)) {
      if (raw.toLowerCase().includes(label)) return session;
    }
  }
  return undefined;
}

function inferSymbol(finding: Finding): string | undefined {
  const fromMetric = finding.evidence.find((e) => /symbol|instrument/i.test(e.label));
  if (fromMetric && /^[A-Z0-9._-]{3,20}$/i.test(fromMetric.value.trim())) {
    return fromMetric.value.trim().toUpperCase();
  }
  const m = finding.title.match(/\b([A-Z]{3,10}(?:USD|USDT|JPY|GBP|EUR|CAD|AUD|NZD|CHF)?)\b/);
  return m?.[1];
}
