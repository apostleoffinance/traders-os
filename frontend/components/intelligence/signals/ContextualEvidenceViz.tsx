"use client";

import type { AnalyticsDashboard, GroupRow } from "@/lib/analytics";
import type { Finding } from "@/lib/intelligence";
import { sessionLabel, signed } from "@/lib/format";

type RankRow = {
  label: string;
  value: string;
  n: number;
  numeric: number;
  tone: "pos" | "neg" | "neutral";
  highlight: boolean;
};

/**
 * One contextual DOM visual answering “why am I seeing this?”
 * Uses dashboard group rows only — no invented series.
 */
export function ContextualEvidenceViz({
  finding,
  dashboard,
}: {
  finding: Finding;
  dashboard: AnalyticsDashboard | null;
}) {
  if (!dashboard) return null;

  const ranks = buildRanks(finding, dashboard);
  if (!ranks || ranks.rows.length === 0) return null;

  const maxAbs = Math.max(...ranks.rows.map((r) => Math.abs(r.numeric)), 0.01);

  return (
    <div className="ctx" role="img" aria-label={ranks.aria}>
      <p className="ctx-title">{ranks.title}</p>
      <ul className="ranks">
        {ranks.rows.map((row) => {
          const width = Math.max(8, Math.round((Math.abs(row.numeric) / maxAbs) * 100));
          return (
            <li key={row.label} className={`row ${row.highlight ? "hi" : ""}`}>
              <span className="name">{row.label}</span>
              <div className="track">
                <div className={`fill ${row.tone}`} style={{ width: `${width}%` }} />
              </div>
              <span className={`val ${row.tone}`}>
                {row.value}
                <span className="n"> · {row.n}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="caption">{ranks.caption}</p>
      <style jsx>{`
        .ctx {
          display: grid;
          gap: 8px;
          padding: 12px 0;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .ctx-title {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-muted);
        }
        .ranks {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .row {
          display: grid;
          grid-template-columns: minmax(72px, 120px) 1fr auto;
          gap: 10px;
          align-items: center;
        }
        .row.hi .name {
          color: var(--text-primary);
          font-weight: 700;
        }
        .name {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .track {
          height: 8px;
          border-radius: 4px;
          background: var(--surface-2);
          overflow: hidden;
        }
        .fill {
          height: 100%;
          border-radius: inherit;
          background: var(--accent);
          min-width: 2px;
        }
        .fill.pos {
          background: var(--pos);
        }
        .fill.neg {
          background: var(--neg);
        }
        .val {
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
          min-width: 5.5rem;
          text-align: right;
        }
        .val.pos {
          color: var(--pos);
        }
        .val.neg {
          color: var(--neg);
        }
        .n {
          font-weight: 600;
          color: var(--text-muted);
          font-size: 11px;
        }
        .caption {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        @media (max-width: 560px) {
          .row {
            grid-template-columns: minmax(64px, 1fr) auto;
            grid-template-rows: auto auto;
          }
          .track {
            grid-column: 1 / -1;
            grid-row: 2;
          }
        }
      `}</style>
    </div>
  );
}

function buildRanks(
  finding: Finding,
  dashboard: AnalyticsDashboard,
): { title: string; aria: string; caption: string; rows: RankRow[] } | null {
  const hay = `${finding.id} ${finding.title} ${finding.domain}`.toLowerCase();
  const subject = finding.comparison?.subjectLabel?.toLowerCase() ?? "";

  if (hay.includes("session") || finding.domain === "calendar" || subject.includes("london") || subject.includes("asia") || subject.includes("york")) {
    return fromGroups(
      "Session comparison",
      dashboard.sessions,
      (key) => sessionLabel(key),
      finding,
      "Average result by session in this view.",
    );
  }

  if (hay.includes("setup") || hay.includes("edge") || finding.domain === "edge") {
    const setups = dashboard.setups ?? [];
    if (setups.length) {
      return fromGroups(
        "Setup comparison",
        setups,
        (key, row) => row.label || key,
        finding,
        "Average result by setup in this view.",
      );
    }
  }

  if (hay.includes("weekday") || hay.includes("day")) {
    return fromGroups(
      "Weekday comparison",
      dashboard.weekday,
      (key) => key,
      finding,
      "Average result by weekday in this view.",
    );
  }

  // Fallback: if comparison exists, EvidenceStrip already covers it — skip duplicate
  return null;
}

function fromGroups(
  title: string,
  groups: GroupRow[],
  labelOf: (key: string, row: GroupRow) => string,
  finding: Finding,
  caption: string,
): { title: string; aria: string; caption: string; rows: RankRow[] } | null {
  const eligible = groups
    .filter((g) => g.n > 0 && g.expectancy_r != null)
    .map((g) => {
      const numeric = Number(g.expectancy_r);
      const label = labelOf(g.key, g);
      const highlight =
        label.toLowerCase().includes((finding.comparison?.subjectLabel ?? "").toLowerCase()) ||
        finding.title.toLowerCase().includes(label.toLowerCase()) ||
        (finding.comparison?.subjectLabel ?? "").toLowerCase().includes(label.toLowerCase());
      return {
        label,
        value: `${signed(numeric)}R`,
        n: g.n,
        numeric: Number.isFinite(numeric) ? numeric : 0,
        tone: (numeric > 0 ? "pos" : numeric < 0 ? "neg" : "neutral") as RankRow["tone"],
        highlight,
      };
    })
    .sort((a, b) => Math.abs(b.numeric) - Math.abs(a.numeric))
    .slice(0, 5);

  if (!eligible.length) return null;

  const sampleNote = eligible.map((r) => `${r.label} ${r.n}`).join(", ");
  return {
    title,
    aria: `${title}: ${eligible.map((r) => `${r.label} ${r.value}`).join("; ")}`,
    caption: `Based on ${sampleNote} trade${eligible.reduce((s, r) => s + r.n, 0) === 1 ? "" : "s"} in this filter.`,
    rows: eligible,
  };
}
