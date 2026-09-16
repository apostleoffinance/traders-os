"use client";

import { ReportHeader } from "./ReportHeader";
import { ReportExecutiveSummary } from "./ReportExecutiveSummary";
import { ReportPerformanceSection } from "./ReportPerformanceSection";
import { ReportEdgeSection } from "./ReportEdgeSection";
import { ReportExecutionSection } from "./ReportExecutionSection";
import { ReportRiskSection } from "./ReportRiskSection";
import { ReportBehaviorSection } from "./ReportBehaviorSection";
import { ReportPlaybookSection } from "./ReportPlaybookSection";
import { ReportTradesSection } from "./ReportTradesSection";
import { ReportCostsSection } from "./ReportCostsSection";
import { ReportComparisonSection } from "./ReportComparisonSection";
import { ReportRecommendationsSection } from "./ReportRecommendationsSection";
import { ReportDataQualitySection } from "./ReportDataQualitySection";
import { ReportWinLossSection } from "./ReportWinLossSection";
import { ReportYearInReviewSection } from "./ReportYearInReviewSection";
import { ReportInterpretationSection } from "./ReportInterpretationSection";
import { ReportChapter } from "./story/ReportChapter";
import type { PerformanceReport, ReportInterpretation } from "@/lib/reports";

/** Story spine TOC — matches ReportChapter ids. */
const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "performance", label: "1. Performance" },
  { id: "edge", label: "2. Edge" },
  { id: "risk", label: "3. Risk" },
  { id: "behavior", label: "4. Behaviour" },
  { id: "execution", label: "5. Execution" },
  { id: "comparison", label: "6. Evolution" },
  { id: "recommendations", label: "7. Actions" },
  { id: "win-loss", label: "Win/Loss detail" },
  { id: "playbooks", label: "Playbooks" },
  { id: "trades", label: "Trades" },
  { id: "costs", label: "Costs" },
  { id: "year-review", label: "Year in review" },
  { id: "interpretation", label: "AI narrative" },
  { id: "data-quality", label: "Data quality" },
];

export function ReportShell({
  data,
  interpretation,
  onExportPdf,
  onRegenerateAi,
  aiLoading,
}: {
  data: PerformanceReport;
  interpretation?: ReportInterpretation | null;
  onExportPdf?: () => void;
  onRegenerateAi?: () => void;
  aiLoading?: boolean;
}) {
  const currency = data.account.currency;

  return (
    <div className="report-shell">
      <nav className="report-nav" aria-label="Report sections">
        {SECTIONS.filter((s) => {
          if (s.id === "interpretation" && !interpretation) return false;
          if (s.id === "comparison" && !data.comparison) return false;
          if (s.id === "year-review" && !data.year_in_review) return false;
          return true;
        }).map((s) => (
          <a key={s.id} href={`#${s.id}`} className="nav-link">
            {s.label}
          </a>
        ))}
        {onRegenerateAi && (
          <button type="button" className="export-btn" onClick={onRegenerateAi} disabled={aiLoading}>
            {aiLoading ? "Generating AI…" : interpretation ? "Regenerate AI" : "Generate AI narrative"}
          </button>
        )}
        {onExportPdf && (
          <button type="button" className="export-btn" onClick={onExportPdf}>
            Export PDF
          </button>
        )}
      </nav>

      <article className="report-body">
        <ReportHeader data={data} />
        <section id="summary" className="block">
          <ReportExecutiveSummary data={data} aiSummary={interpretation?.result.executive_summary} />
        </section>

        {/* Chapters own their section ids via ReportChapter */}
        <ReportPerformanceSection performance={data.performance} currency={currency} confidence={data.confidence} />
        <ReportEdgeSection edge={data.edge} />
        <ReportRiskSection risk={data.risk} currency={currency} />
        <ReportBehaviorSection behavior={data.behavior} />
        <ReportExecutionSection execution={data.execution} decisionQuality={data.decision_quality} />

        {data.comparison && (
          <ReportChapter
            id="comparison"
            title="6. Evolution"
            question="What changed versus the prior period?"
            takeaway="Use period deltas to decide whether the edge is improving, flat, or degrading — not to chase noise."
          >
            <ReportComparisonSection comparison={data.comparison} reportType={data.report.type} />
          </ReportChapter>
        )}

        <ReportChapter
          id="recommendations"
          title="7. Actions"
          question="What should I investigate or change next?"
          takeaway="Prioritize process fixes over outcome chasing — one investigation at a time."
        >
          <ReportRecommendationsSection recommendations={data.recommendations} />
        </ReportChapter>

        <section id="win-loss" className="block">
          <ReportWinLossSection performance={data.performance} currency={currency} />
        </section>
        <section id="playbooks" className="block">
          <ReportPlaybookSection playbooks={data.playbooks} />
        </section>
        <section id="trades" className="block">
          <ReportTradesSection highlights={data.trade_highlights} decisionQuality={data.decision_quality} currency={currency} />
        </section>
        <section id="costs" className="block">
          <ReportCostsSection costs={data.costs} currency={currency} />
        </section>
        {data.year_in_review && (
          <section id="year-review" className="block">
            <ReportYearInReviewSection yearInReview={data.year_in_review} currency={currency} />
          </section>
        )}
        {interpretation && (
          <section id="interpretation" className="block">
            <ReportInterpretationSection interpretation={interpretation} />
          </section>
        )}
        <section id="data-quality" className="block">
          <ReportDataQualitySection dataQuality={data.data_quality} confidence={data.confidence} />
        </section>
      </article>

      <style jsx>{`
        .report-shell {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 24px;
          align-items: start;
          max-width: 100%;
          min-width: 0;
        }
        .report-nav {
          position: sticky;
          top: 72px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 0;
        }
        :global(.report-nav .nav-link) {
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 6px;
          color: var(--muted);
          text-decoration: none;
        }
        :global(.report-nav .nav-link:hover) {
          background: var(--surface-2);
          color: var(--ink);
        }
        .export-btn {
          margin-top: 12px;
          border: 1px solid var(--border);
          background: var(--surface);
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }
        .report-body {
          min-width: 0;
          max-width: 100%;
        }
        .block {
          margin-bottom: 28px;
          scroll-margin-top: 80px;
        }
        .h {
          margin: 0 0 6px;
          font-size: 18px;
          font-weight: 650;
        }
        .q {
          margin: 0 0 14px;
          font-size: 14px;
          color: var(--text-muted);
        }
        @media (max-width: 900px) {
          .report-shell {
            grid-template-columns: 1fr;
          }
          .report-nav {
            position: static;
            flex-direction: row;
            flex-wrap: wrap;
          }
        }
        @media print {
          .report-nav {
            display: none;
          }
          .report-shell {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
