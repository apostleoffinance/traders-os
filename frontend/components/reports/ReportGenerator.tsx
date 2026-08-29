"use client";

import { useMemo, useState } from "react";
import { REPORT_TYPE_LABELS, type ReportType } from "@/lib/reports";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function ReportGenerator({
  onGenerate,
  loading,
}: {
  onGenerate: (opts: { type: ReportType; year: number; month?: number; quarter?: number }) => void;
  loading: boolean;
}) {
  const now = new Date();
  const [type, setType] = useState<ReportType>("monthly");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.ceil((now.getMonth() + 1) / 3));

  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => now.getFullYear() - i), [now]);

  return (
    <div className="generator">
      <div className="field">
        <label>Report type</label>
        <select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
          {(Object.keys(REPORT_TYPE_LABELS) as ReportType[]).map((t) => (
            <option key={t} value={t}>
              {REPORT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Year</label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
      {type === "monthly" && (
        <div className="field">
          <label>Month</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}
      {type === "quarterly" && (
        <div className="field">
          <label>Quarter</label>
          <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                Q{q}
              </option>
            ))}
          </select>
        </div>
      )}
      <button
        type="button"
        className="generate"
        disabled={loading}
        onClick={() => onGenerate({ type, year, month: type === "monthly" ? month : undefined, quarter: type === "quarterly" ? quarter : undefined })}
      >
        {loading ? "Generating…" : "Generate report"}
      </button>
      <style jsx>{`
        .generator {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: flex-end;
          padding: 16px;
          border: 1px solid var(--border);
          border-radius: 10px;
          margin-bottom: 24px;
          background: var(--surface);
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted);
        }
        select {
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--bg);
          min-width: 140px;
        }
        .generate {
          padding: 10px 20px;
          background: var(--accent);
          color: var(--accent-contrast, #fff);
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
        }
        .generate:disabled {
          opacity: 0.6;
        }
      `}</style>
    </div>
  );
}
