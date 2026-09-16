"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { Finding } from "@/lib/intelligence";
import {
  confidenceText,
  filterPatchFromFinding,
  friendlyConfidenceLabel,
  toSignalViewModel,
} from "@/lib/intelligence";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui";
import { EvidenceStrip } from "./EvidenceStrip";
import { useFindingDetail } from "./FindingDetailContext";

const FindingExplanation = dynamic(
  () => import("./FindingExplanation").then((m) => m.FindingExplanation),
  {
    ssr: false,
    loading: () => (
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Loading explanation…
      </p>
    ),
  },
);

/** Finding detail sheet — facts first; related trades reuse analytics drilldown. */
export function FindingDetailDrawer({
  periodLabel,
  accountId,
}: {
  periodLabel?: string;
  accountId: string;
}) {
  const { finding, closeFinding } = useFindingDetail();
  const drill = useOptionalAnalyticsDrilldown();
  const open = finding != null;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && closeFinding()}>
      <SheetContent side="right" className="finding-drawer w-full max-w-md overflow-y-auto sm:max-w-lg">
        {finding ? (
          <FindingDetailBody
            finding={finding}
            periodLabel={periodLabel}
            drill={drill}
            accountId={accountId}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FindingDetailBody({
  finding,
  periodLabel,
  drill,
  accountId,
}: {
  finding: Finding;
  periodLabel?: string;
  drill: ReturnType<typeof useOptionalAnalyticsDrilldown>;
  accountId: string;
}) {
  const vm = toSignalViewModel(finding);
  const confidence = friendlyConfidenceLabel(finding.confidence);
  const href = finding.action.href || finding.destination.href;
  const labLabel = finding.destination.label || "Related analysis";

  const openRelatedTrades = () => {
    if (!drill) return;
    const patch = filterPatchFromFinding(finding);
    if (Object.keys(patch).length) {
      drill.applyPatch(patch, finding.title);
    }
    drill.openTrades(
      finding.sampleSize > 0 ? `Related trades · ${finding.sampleSize}` : `Related trades · ${finding.title}`,
    );
  };

  return (
    <div className="body">
      <SheetHeader className="pr-8">
        <p className="eyebrow">
          <span className={`status status-${vm.status}`}>{vm.statusLabel}</span>
          <span className="type">{vm.categoryLabel}</span>
        </p>
        <SheetTitle className="title">{finding.title}</SheetTitle>
        <SheetDescription className="summary">{finding.summary}</SheetDescription>
      </SheetHeader>

      <section className="block" aria-labelledby="finding-evidence">
        <h3 id="finding-evidence">Evidence</h3>
        {finding.metric ? (
          <p className={`hero ${finding.metric.tone ?? "neutral"}`}>
            <span className="hero-value">{finding.metric.value}</span>
            <span className="hero-label">{finding.metric.label}</span>
          </p>
        ) : null}
        <EvidenceStrip evidence={finding.evidence} comparison={finding.comparison} />
      </section>

      <section className="block" aria-labelledby="finding-why">
        <h3 id="finding-why">Why it matters</h3>
        <p>{finding.whyItMatters}</p>
      </section>

      <section className="block meta-grid" aria-label="Trades analyzed">
        <div>
          <span className="k">Pattern strength</span>
          <span className="v">{confidence}</span>
        </div>
        <div>
          <span className="k">Trades analyzed</span>
          <span className="v">
            {finding.sampleSize} trade{finding.sampleSize === 1 ? "" : "s"}
          </span>
        </div>
        {periodLabel ? (
          <div>
            <span className="k">Period</span>
            <span className="v">{periodLabel}</span>
          </div>
        ) : null}
        <div>
          <span className="k">Category</span>
          <span className="v">{vm.categoryLabel}</span>
        </div>
      </section>

      <section className="block" aria-labelledby="finding-investigate">
        <h3 id="finding-investigate">Investigate</h3>
        <div className="actions">
          {drill ? (
            <button type="button" className="btn primary" onClick={openRelatedTrades}>
              {finding.sampleSize > 0
                ? `View ${finding.sampleSize} related trade${finding.sampleSize === 1 ? "" : "s"}`
                : "View related trades"}
            </button>
          ) : null}
          {href ? (
            <Link href={href} className="btn">
              Open {labLabel} →
            </Link>
          ) : null}
        </div>
      </section>

      <details className="method">
        <summary>How this signal was generated</summary>
        <p>{finding.whySurfaced}</p>
        <p className="tech" title="Research detail">
          {confidenceText(finding.confidence, finding.sampleSize)} · source {finding.source}
        </p>
      </details>

      <FindingExplanation finding={finding} accountId={accountId} periodLabel={periodLabel} />

      <style jsx>{`
        .body {
          display: grid;
          gap: 18px;
          padding-top: 8px;
          padding-bottom: 24px;
        }
        .eyebrow {
          margin: 0 0 6px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .status {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--accent-text, var(--accent));
        }
        .status-positive {
          color: var(--pos);
        }
        .status-risk {
          color: var(--neg);
        }
        .type {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        :global(.finding-drawer .title) {
          font-size: 1.15rem !important;
          line-height: 1.3;
          letter-spacing: -0.01em;
        }
        :global(.finding-drawer .summary) {
          font-size: 13px !important;
          line-height: 1.45;
        }
        .block h3 {
          margin: 0 0 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .block p {
          margin: 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-secondary);
        }
        .hero {
          margin: 0 0 10px;
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .hero-value {
          font-size: 1.5rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
        }
        .hero.pos .hero-value {
          color: var(--pos);
        }
        .hero.neg .hero-value {
          color: var(--neg);
        }
        .hero-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .meta-grid .k {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        .meta-grid .v {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .actions {
          display: grid;
          gap: 8px;
          padding-top: 4px;
        }
        .actions :global(.btn),
        .actions .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 650;
          text-decoration: none;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-primary);
          cursor: pointer;
          font-family: inherit;
        }
        .actions :global(.btn.primary),
        .actions .btn.primary {
          background: var(--accent);
          border-color: transparent;
          color: var(--accent-contrast);
        }
        .actions :global(.btn:focus-visible),
        .actions .btn:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .method {
          border-top: 1px solid var(--border);
          padding-top: 10px;
        }
        .method summary {
          cursor: pointer;
          font-size: 12px;
          font-weight: 650;
          color: var(--text-secondary);
          list-style: none;
        }
        .method summary::-webkit-details-marker {
          display: none;
        }
        .method summary::before {
          content: "▸ ";
          color: var(--text-muted);
        }
        .method[open] summary::before {
          content: "▾ ";
        }
        .method summary:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .method p {
          margin: 8px 0 0;
          font-size: 12px;
          line-height: 1.45;
          color: var(--text-muted);
        }
        .tech {
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          font-size: 11px !important;
        }
      `}</style>
    </div>
  );
}
