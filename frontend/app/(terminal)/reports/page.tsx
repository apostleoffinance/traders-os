"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { api, getActiveAccountId } from "@/lib/api";
import { formatAiError, useAiStatus } from "@/lib/ai";
import { Alert } from "@/components/ui";
import { ReportGenerator } from "@/components/reports/ReportGenerator";
import { ReportShell } from "@/components/reports/ReportShell";
import {
  interpretEndpoint,
  reportEndpoint,
  type PerformanceReport,
  type ReportInterpretation,
  type ReportType,
  type ReportWithInterpretation,
} from "@/lib/reports";

export default function ReportsPage() {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [interpretation, setInterpretation] = useState<ReportInterpretation | null>(null);
  const [lastOpts, setLastOpts] = useState<{ type: ReportType; year: number; month?: number; quarter?: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [includeAi, setIncludeAi] = useState(true);
  const aiStatus = useAiStatus();

  const fetchInterpretation = useCallback(
    async (opts: { type: ReportType; year: number; month?: number; quarter?: number }, force = false) => {
      const accountId = getActiveAccountId();
      if (!accountId || !aiStatus?.available) return;
      setAiLoading(true);
      setAiError(null);
      try {
        const path = interpretEndpoint(opts.type, accountId, { ...opts, force });
        const data = await api<ReportWithInterpretation>(path);
        setReport(data.report);
        setInterpretation(data.interpretation);
      } catch (err) {
        setAiError(formatAiError(err));
      } finally {
        setAiLoading(false);
      }
    },
    [aiStatus?.available],
  );

  const generate = useCallback(
    async (opts: { type: ReportType; year: number; month?: number; quarter?: number }) => {
      const accountId = getActiveAccountId();
      if (!accountId) {
        setError("Select an account to generate a report.");
        return;
      }
      setLoading(true);
      setError(null);
      setAiError(null);
      setInterpretation(null);
      setLastOpts(opts);
      try {
        if (includeAi && aiStatus?.available) {
          setAiLoading(true);
          try {
            const path = interpretEndpoint(opts.type, accountId, opts);
            const data = await api<ReportWithInterpretation>(path);
            setReport(data.report);
            setInterpretation(data.interpretation);
          } catch (err) {
            setAiError(formatAiError(err));
            const path = reportEndpoint(opts.type, accountId, { year: opts.year, month: opts.month, quarter: opts.quarter });
            const data = await api<PerformanceReport>(path);
            setReport(data);
          } finally {
            setAiLoading(false);
          }
        } else {
          const path = reportEndpoint(opts.type, accountId, { year: opts.year, month: opts.month, quarter: opts.quarter });
          const data = await api<PerformanceReport>(path);
          setReport(data);
        }
      } catch (err) {
        setReport(null);
        setError(err instanceof Error ? err.message : "Failed to generate report.");
      } finally {
        setLoading(false);
      }
    },
    [includeAi, aiStatus?.available],
  );

  const regenerateAi = useCallback(() => {
    if (lastOpts) void fetchInterpretation(lastOpts, true);
  }, [lastOpts, fetchInterpretation]);

  const exportPdf = () => {
    window.print();
  };

  return (
    <div className="reports-page">
      <p className="page-kicker">Reports</p>
      <h1>Performance Intelligence Report</h1>
      <p className="intro">
        Institutional-quality performance, risk, discipline, and intelligence — built from your journal data. All metrics are
        computed deterministically on the server.
      </p>

      {!getActiveAccountId() && (
        <Alert kind="info">
          <Link href="/accounts">Select an account</Link> to generate reports.
        </Alert>
      )}

      {aiStatus && !aiStatus.available && (
        <Alert kind="warn">AI interpretation is unavailable. Reports will load without narrative analysis.</Alert>
      )}

      <label className="ai-toggle">
        <input type="checkbox" checked={includeAi} onChange={(e) => setIncludeAi(e.target.checked)} disabled={!aiStatus?.available} />
        Include AI interpretation
      </label>

      <ReportGenerator onGenerate={generate} loading={loading || aiLoading} />
      {error && <Alert kind="danger">{error}</Alert>}
      {aiError && <Alert kind="warn">{aiError}</Alert>}

      {report && (
        <ReportShell
          data={report}
          interpretation={interpretation}
          onExportPdf={exportPdf}
          onRegenerateAi={aiStatus?.available ? regenerateAi : undefined}
          aiLoading={aiLoading}
        />
      )}

      <style jsx>{`
        .intro {
          max-width: 640px;
          color: var(--muted);
          margin-bottom: 12px;
          line-height: 1.55;
        }
        .ai-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          margin-bottom: 12px;
          color: var(--muted);
        }
        @media print {
          .intro,
          .ai-toggle,
          :global(.generator) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
