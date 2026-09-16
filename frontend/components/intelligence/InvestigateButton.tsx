"use client";

import Link from "next/link";
import type { Finding } from "@/lib/intelligence";
import { useOptionalFindingDetail } from "./FindingDetailContext";

/** Opens finding detail drawer when available; otherwise navigates to destination. */
export function InvestigateButton({
  finding,
  label = "Investigate →",
  className = "cta",
}: {
  finding: Finding;
  label?: string;
  className?: string;
}) {
  const detail = useOptionalFindingDetail();
  const href = finding.action.href || finding.destination.href;

  if (detail) {
    return (
      <button
        type="button"
        className={className}
        onClick={() => detail.openFinding(finding)}
        aria-label={`${label.replace(/→/g, "").trim()}: ${finding.title}`}
      >
        {label}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }

  return (
    <span className={`${className} disabled`} aria-disabled>
      {label}
    </span>
  );
}
