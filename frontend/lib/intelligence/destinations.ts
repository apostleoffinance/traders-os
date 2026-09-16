import type { AnalyticsPageId } from "@/lib/analytics/types";
import type { FindingDestination, FindingDomain, FindingType } from "./types";

const DEST: Record<
  FindingDomain,
  { label: string; href: string; tab?: AnalyticsPageId; actionLabel: string }
> = {
  edge: {
    label: "Edge Lab",
    href: "/analytics?tab=edge",
    tab: "edge",
    actionLabel: "Investigate Edge →",
  },
  behaviour: {
    label: "Behaviour Lab",
    href: "/analytics?tab=behaviour",
    tab: "behaviour",
    actionLabel: "Investigate Behaviour →",
  },
  execution: {
    label: "Execution Lab",
    href: "/analytics?tab=execution",
    tab: "execution",
    actionLabel: "Investigate Execution →",
  },
  risk: {
    label: "Risk",
    href: "/analytics?tab=risk",
    tab: "risk",
    actionLabel: "Investigate Risk →",
  },
  performance: {
    label: "Performance",
    href: "/analytics?tab=performance",
    tab: "performance",
    actionLabel: "Investigate Performance →",
  },
  consistency: {
    label: "Behaviour Lab",
    href: "/analytics?tab=behaviour",
    tab: "behaviour",
    actionLabel: "Investigate Behaviour →",
  },
  calendar: {
    label: "Calendar",
    href: "/analytics?tab=calendar",
    tab: "calendar",
    actionLabel: "Investigate Calendar →",
  },
  quant: {
    label: "Quant Lab",
    href: "/quant-lab?tab=overview",
    actionLabel: "Open Quant Lab →",
  },
  general: {
    label: "Analytics",
    href: "/analytics",
    tab: "overview",
    actionLabel: "Open Analytics →",
  },
};

export function destinationFor(domain: FindingDomain): FindingDestination {
  const d = DEST[domain];
  return { label: d.label, href: d.href, tab: d.tab };
}

export function defaultActionLabel(domain: FindingDomain): string {
  return DEST[domain].actionLabel;
}

export function domainFromFindingType(type: FindingType): FindingDomain {
  switch (type) {
    case "EDGE":
    case "OPPORTUNITY":
      return "edge";
    case "BEHAVIOUR":
      return "behaviour";
    case "EXECUTION":
      return "execution";
    case "RISK":
    case "WARNING":
      return "risk";
    case "PERFORMANCE":
      return "performance";
    case "CONSISTENCY":
      return "consistency";
    default:
      return "general";
  }
}

/** Map loose category strings from feed/lab into domains. */
export function domainFromCategory(category: string, typeHint?: string): FindingDomain {
  const c = category.toLowerCase();
  const t = (typeHint ?? "").toLowerCase();
  if (c.includes("edge") || c.includes("session") || c.includes("setup") || c.includes("playbook") || t.includes("edge")) {
    return "edge";
  }
  if (c.includes("behav") || c.includes("discipl") || c.includes("psych") || c.includes("emotion")) {
    return "behaviour";
  }
  if (c.includes("execut") || c.includes("exit") || c.includes("mfe")) return "execution";
  if (c.includes("risk") || c.includes("drawdown") || c.includes("halt")) return "risk";
  if (c.includes("calendar") || c.includes("temporal") || c.includes("today")) return "calendar";
  if (c.includes("quant") || c.includes("rolling")) return "quant";
  if (c.includes("consist") || c.includes("process") || c.includes("improv")) return "consistency";
  if (c.includes("perform") || c.includes("cost") || c.includes("pnl")) return "performance";
  return domainFromFindingType(typeFromCategory(category, typeHint));
}

export function typeFromCategory(category: string, typeHint?: string): FindingType {
  const c = category.toLowerCase();
  const t = (typeHint ?? "").toUpperCase();
  if (t === "EDGE" || t === "BEHAVIOUR" || t === "EXECUTION" || t === "RISK" || t === "PERFORMANCE" || t === "CONSISTENCY" || t === "OPPORTUNITY" || t === "WARNING") {
    return t;
  }
  if (c.includes("opportunity") || (c.includes("playbook") && c.includes("top"))) return "OPPORTUNITY";
  if (c.includes("warn") || c.includes("halt") || c.includes("danger")) return "WARNING";
  if (c.includes("edge") || c.includes("session") || c.includes("setup") || c.includes("playbook") || c.includes("instrument")) {
    return "EDGE";
  }
  if (c.includes("behav") || c.includes("discipl") || c.includes("psych") || c.includes("revenge") || c.includes("overtrad")) {
    return "BEHAVIOUR";
  }
  if (c.includes("execut") || c.includes("exit") || c.includes("mfe")) return "EXECUTION";
  if (c.includes("risk") || c.includes("drawdown") || c.includes("escalat")) return "RISK";
  if (c.includes("consist") || c.includes("process")) return "CONSISTENCY";
  if (c.includes("today") || c.includes("activity")) return "PERFORMANCE";
  return "PERFORMANCE";
}
