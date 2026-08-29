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
import type { PerformanceReport, ReportInterpretation } from "@/lib/reports";

const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "performance", label: "Performance" },
  { id: "win-loss", label: "Win/Loss" },
  { id: "execution", label: "Execution" },
  { id: "risk", label: "Risk" },
  { id: "behavior", label: "Behavior" },
  { id: "playbooks", label: "Playbooks" },
  { id: "trades", label: "Trades" },
  { id: "costs", label: "Costs" },
  { id: "comparison", label: "Evolution" },
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
        {SECTIONS.filter((s) => s.id !== "interpretation" || interpretation).map((s) => (
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
        <section id="summary">
          <ReportExecutiveSummary data={data} aiSummary={interpretation?.result.executive_summary} />
        </section>
        <section id="performance">
          <ReportPerformanceSection performance={data.performance} currency={currency} confidence={data.confidence} />
        </section>
        <section id="win-loss">
          <ReportWinLossSection performance={data.performance} currency={currency} />
        </section>
        <section id="edge">
          <ReportEdgeSection edge={data.edge} />
        </section>
        <section id="execution">
          <ReportExecutionSection execution={data.execution} decisionQuality={data.decision_quality} />
        </section>
        <section id="risk">
          <ReportRiskSection risk={data.risk} currency={currency} />
        </section>
        <section id="behavior">
          <ReportBehaviorSection behavior={data.behavior} />
        </section>
        <section id="playbooks">
          <ReportPlaybookSection playbooks={data.playbooks} />
        </section>
        <section id="trades">
          <ReportTradesSection highlights={data.trade_highlights} decisionQuality={data.decision_quality} currency={currency} />
        </section>
        <section id="costs">
          <ReportCostsSection costs={data.costs} currency={currency} />
        </section>
        {data.comparison && (
          <section id="comparison">
            <ReportComparisonSection comparison={data.comparison} reportType={data.report.type} />
          </section>
        )}
        {data.year_in_review && (
          <section id="year-review">
            <ReportYearInReviewSection yearInReview={data.year_in_review} currency={currency} />
          </section>
        )}
        <section id="recommendations">
          <ReportRecommendationsSection recommendations={data.recommendations} />
        </section>
        {interpretation && (
          <section id="interpretation">
            <ReportInterpretationSection interpretation={interpretation} />
          </section>
        )}
        <section id="data-quality">
          <ReportDataQualitySection dataQuality={data.data_quality} confidence={data.confidence} />
        </section>
      </article>

      <style jsx>{`
        .report-shell {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 24px;
          align-items: start;
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
        .report-body section {
          margin-bottom: 28px;
          scroll-margin-top: 80px;
        }
        .year-banner h2 {
          font-size: 22px;
          letter-spacing: 0.04em;
          margin: 24px 0 8px;
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
