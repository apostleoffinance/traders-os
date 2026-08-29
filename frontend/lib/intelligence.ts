export type InsightEvidence = {
  n: number;
  level: string;
  label: string;
  reason: string;
};

export type InsightComparison = {
  baseline: string;
  subject: string;
  subject_value: string;
  baseline_value: string;
};

export type InsightAction = {
  label: string;
  href: string;
};

export type IntelligenceInsight = {
  id: string;
  category: string;
  type: string;
  severity: "positive" | "warn" | "danger" | "info" | string;
  title: string;
  summary: string;
  why: string;
  evidence: InsightEvidence;
  comparison: InsightComparison | null;
  action: InsightAction | null;
  priority: number;
};

export type IntelligenceFeedResponse = {
  account: {
    id: string;
    name: string;
    firm: string;
    currency: string;
  };
  filters: {
    preset: string;
    date_from: string | null;
    date_to: string | null;
  };
  summary: {
    total: number;
    today_count: number;
    positive: number;
    warnings: number;
  };
  feed: {
    today: IntelligenceInsight[];
    insights: IntelligenceInsight[];
  };
};
