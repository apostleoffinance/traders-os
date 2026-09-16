"use client";

import type { AnalyticsDashboard, IntelligenceLabPayload } from "@/lib/analytics";
import type { Finding } from "@/lib/intelligence";

type BehaviourRow = {
  id: string;
  label: string;
  value: string;
  pct: number | null;
  tone: "pos" | "neg" | "neutral" | "muted";
  note?: string;
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Visual behaviour strip from deterministic lab + overview fields.
 * Never invents scores — shows “not enough data” when absent.
 */
export function BehaviourSignals({
  dashboard,
  lab,
  behaviourFindings,
}: {
  dashboard: AnalyticsDashboard;
  lab: IntelligenceLabPayload | null;
  behaviourFindings: Finding[];
}) {
  const rows = buildRows(dashboard, lab, behaviourFindings);
  if (!rows.length) return null;

  const interpretation =
    behaviourFindings[0]?.whyItMatters ??
    (dashboard.overview.discipline_score != null
      ? "Your recorded process markers look consistent across trades in this view."
      : "Behaviour markers appear as you log plan adherence, risk, and post-trade notes.");

  return (
    <section className="behaviour" aria-labelledby="behaviour-title">
      <header className="head">
        <h2 id="behaviour-title">Behaviour signals</h2>
        <p className="sub">From your logged process — not inferred personality.</p>
      </header>

      <ul className="list">
        {rows.map((row) => (
          <li key={row.id} className="row">
            <div className="label-row">
              <span className="label">{row.label}</span>
              <span className={`value ${row.tone}`}>{row.value}</span>
            </div>
            {row.pct != null ? (
              <div
                className="track"
                role="img"
                aria-label={`${row.label}: ${row.value}`}
              >
                <div className={`fill ${row.tone}`} style={{ width: `${row.pct}%` }} />
              </div>
            ) : (
              <p className="note">{row.note ?? "Not enough data"}</p>
            )}
          </li>
        ))}
      </ul>

      <p className="interp">{interpretation}</p>

      <style jsx>{`
        .behaviour {
          display: grid;
          gap: 12px;
          padding: 14px;
          border: 1px solid var(--border);
          border-radius: 12px;
          background: var(--surface);
        }
        .head {
          display: grid;
          gap: 2px;
        }
        h2 {
          margin: 0;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-primary);
        }
        .sub {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 12px;
        }
        .row {
          display: grid;
          gap: 6px;
        }
        .label-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: baseline;
        }
        .label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .value {
          font-size: 12px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          font-family: var(--font-mono), ui-monospace, Menlo, monospace;
        }
        .value.pos {
          color: var(--pos);
        }
        .value.neg {
          color: var(--neg);
        }
        .value.muted,
        .value.neutral {
          color: var(--text-muted);
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
        .note {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .interp {
          margin: 0;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
          max-width: 62ch;
        }
      `}</style>
    </section>
  );
}

function buildRows(
  dashboard: AnalyticsDashboard,
  lab: IntelligenceLabPayload | null,
  behaviourFindings: Finding[],
): BehaviourRow[] {
  const rows: BehaviourRow[] = [];
  const n = dashboard.overview.n_trades;
  const discipline = dashboard.overview.discipline_score;

  if (discipline != null && Number.isFinite(discipline)) {
    const pct = clampPct(Number(discipline));
    rows.push({
      id: "discipline",
      label: "Plan adherence",
      value: `${pct}%`,
      pct,
      tone: pct >= 70 ? "pos" : pct >= 40 ? "neutral" : "neg",
    });
  } else {
    rows.push({
      id: "discipline",
      label: "Plan adherence",
      value: "—",
      pct: null,
      tone: "muted",
      note: n < 3 ? "More trades needed" : "Not enough process data yet",
    });
  }

  const avgRisk = dashboard.overview.average_risk;
  if (avgRisk != null && n > 0) {
    rows.push({
      id: "risk",
      label: "Risk consistency",
      value: "Recorded",
      pct: 100,
      tone: "pos",
      note: undefined,
    });
  } else {
    rows.push({
      id: "risk",
      label: "Risk consistency",
      value: "—",
      pct: null,
      tone: "muted",
      note: "Not enough data",
    });
  }

  const over = lab?.behaviour?.overtrading;
  if (over) {
    const status = String(over.status || "").toLowerCase();
    const clear = status.includes("normal") || status.includes("ok") || status.includes("none");
    rows.push({
      id: "overtrading",
      label: "Overtrading",
      value: clear ? "No clear pattern" : over.status || "Watch",
      pct: clear ? null : 55,
      tone: clear ? "muted" : "neg",
      note: clear
        ? undefined
        : over.max_trades_in_day
          ? `Peak day: ${over.max_trades_in_day} trades`
          : undefined,
    });
  } else {
    rows.push({
      id: "overtrading",
      label: "Overtrading",
      value: "—",
      pct: null,
      tone: "muted",
      note: "No clear pattern",
    });
  }

  const revenge = lab?.behaviour?.revenge_trading;
  const revengeFinding = behaviourFindings.find((f) => f.id.includes("revenge") || f.title.toLowerCase().includes("revenge"));
  if (revengeFinding) {
    rows.push({
      id: "revenge",
      label: "Revenge risk",
      value: revengeFinding.metric?.value ?? "Watch",
      pct: 60,
      tone: "neg",
    });
  } else if (revenge?.risk_multiplier_after_loss_pct != null) {
    const pct = Number(revenge.risk_multiplier_after_loss_pct);
    const elevated = Number.isFinite(pct) && pct >= 15;
    rows.push({
      id: "revenge",
      label: "Revenge risk",
      value: elevated ? `+${numish(pct)}% after loss` : "No evidence yet",
      pct: elevated ? clampPct(pct) : null,
      tone: elevated ? "neg" : "muted",
    });
  } else {
    rows.push({
      id: "revenge",
      label: "Revenge risk",
      value: "—",
      pct: null,
      tone: "muted",
      note: "No evidence yet",
    });
  }

  const earlyExit = behaviourFindings.find(
    (f) =>
      f.domain === "execution" ||
      f.title.toLowerCase().includes("exit") ||
      f.title.toLowerCase().includes("capture"),
  );
  rows.push({
    id: "early-exits",
    label: "Early exits",
    value: earlyExit?.metric?.value ?? "—",
    pct: earlyExit ? 50 : null,
    tone: earlyExit ? "neutral" : "muted",
    note: earlyExit ? undefined : "Not enough data",
  });

  return rows;
}

function numish(n: number): string {
  return Number.isFinite(n) ? n.toFixed(0) : "—";
}
