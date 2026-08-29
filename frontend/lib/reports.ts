/** Performance Intelligence Report — types mirror backend contract v1.0 */

export type ReportType = "monthly" | "quarterly" | "yearly";

export type PerformanceReport = {
  version: string;
  report: {
    id: string;
    type: ReportType;
    generated_at: string;
    status: string;
  };
  period: {
    label: string;
    period_key: string;
    start: string | null;
    end: string | null;
    timezone: string;
    previous: { label: string; start: string | null; end: string | null };
  };
  account: {
    id: string;
    name: string;
    currency: string;
    firm: string | null;
    starting_balance: string;
  };
  executive_summary: {
    scorecard: {
      net_performance: { value: string; return_pct: string | null };
      profit_factor: string | null;
      expectancy_r: string | null;
      discipline: number | null;
      trades: number;
    };
    status: {
      status: string;
      headline: string;
      score: number | null;
      factors: string[];
    };
    narrative_seed: string[];
  };
  performance: Record<string, unknown>;
  edge: Record<string, unknown>;
  execution: Record<string, unknown>;
  costs: Record<string, unknown>;
  risk: Record<string, unknown>;
  behavior: Record<string, unknown>;
  playbooks: Record<string, unknown>;
  decision_quality: Record<string, unknown>;
  trade_highlights: { best: unknown[]; worst: unknown[] };
  comparison: Record<string, unknown> | null;
  recommendations: {
    keep: { id: string; text: string; evidence: unknown[] }[];
    review: { id: string; text: string; evidence: unknown[] }[];
    reduce: { id: string; text: string; evidence: unknown[] }[];
    disclaimer: string;
  };
  data_quality: Record<string, unknown>;
  confidence: { level: string; n: number; message: string };
  temporal?: Record<string, unknown>;
  year_in_review?: Record<string, unknown>;
  quarterly_focus?: Record<string, unknown>;
};

export function reportEndpoint(
  type: ReportType,
  accountId: string,
  params: { year: number; month?: number; quarter?: number },
): string {
  const q = new URLSearchParams({ account_id: accountId, year: String(params.year) });
  if (type === "monthly" && params.month) q.set("month", String(params.month));
  if (type === "quarterly" && params.quarter) q.set("quarter", String(params.quarter));
  return `/api/reports/${type}?${q.toString()}`;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const STATUS_TONE: Record<string, string> = {
  STRONG: "pos",
  STABLE: "pos",
  MIXED: "warn",
  NEEDS_ATTENTION: "neg",
  HIGH_RISK: "neg",
};

export type ReportInterpretation = {
  id: string;
  analysis_type: string;
  provider: string;
  model: string;
  cached: boolean;
  created_at: string | null;
  result: {
    period_label: string;
    executive_summary: string;
    key_observations: {
      category: string;
      observation: string;
      confidence: string;
      evidence: string[];
    }[];
    keep: { text: string; evidence: string[] }[];
    review: { text: string; evidence: string[] }[];
    reduce: { text: string; evidence: string[] }[];
    data_limitations: string[];
    confidence: string;
  };
};

export type ReportWithInterpretation = {
  report: PerformanceReport;
  interpretation: ReportInterpretation;
};

export function interpretEndpoint(
  type: ReportType,
  accountId: string,
  params: { year: number; month?: number; quarter?: number; force?: boolean },
): string {
  const q = new URLSearchParams({
    account_id: accountId,
    report_type: type,
    year: String(params.year),
  });
  if (type === "monthly" && params.month) q.set("month", String(params.month));
  if (type === "quarterly" && params.quarter) q.set("quarter", String(params.quarter));
  if (params.force) q.set("force", "true");
  return `/api/reports/interpret?${q.toString()}`;
}
