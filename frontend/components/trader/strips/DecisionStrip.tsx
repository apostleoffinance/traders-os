"use client";

import { money, num, tone } from "@/lib/format";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { resolveVizCopy } from "@/lib/visualization";

type TabId = "overview" | "performance" | "edge" | "behaviour" | "execution" | "risk" | "calendar";

/** Compact decision cards — behaviour + risk state without dense charts. */
export function DecisionStrip({
  data,
  onTabChange,
}: {
  data: AnalyticsDashboard;
  onTabChange?: (tab: TabId) => void;
}) {
  const o = data.overview;
  const currency = data.account.currency;
  const riskCopy = resolveVizCopy("risk_budget");
  const risk = data.risk;
  const intel = data.lab?.intelligence;
  const overtrading = intel?.behaviour?.overtrading;
  const decision = intel?.decision_quality?.counts;

  const ddTone = tone(o.current_drawdown);
  const maxDd = money(o.max_drawdown, currency);
  const curDd = money(o.current_drawdown, currency);
  const dailyPct = risk?.personal_daily?.pct;

  return (
    <section className="section">
      <h2 className="section-title">Behaviour & risk</h2>
      <p className="section-lead">Quick status — open the dedicated tabs when you need the research views.</p>
      <div className="grid">
        <button type="button" className="card" onClick={() => onTabChange?.("risk")}>
          <strong>{riskCopy.title}</strong>
          <span className="q">{riskCopy.question}</span>
          <div className="metrics">
            <span>
              Current DD <em className={ddTone}>{curDd}</em>
            </span>
            <span>
              Max DD <em>{maxDd}</em>
            </span>
            {dailyPct != null && dailyPct !== "" ? (
              <span>
                Daily loss used <em>{num(dailyPct, 0)}%</em>
              </span>
            ) : null}
          </div>
          <span className="cta">Open Risk →</span>
        </button>
        <button type="button" className="card" onClick={() => onTabChange?.("behaviour")}>
          <strong>Behaviour</strong>
          <span className="q">Is my behavior helping my trading?</span>
          <div className="metrics">
            {overtrading?.status ? (
              <span>
                Activity <em>{String(overtrading.status).replace(/_/g, " ")}</em>
              </span>
            ) : (
              <span className="muted">Tag emotions and process notes to unlock behaviour insights.</span>
            )}
            {decision ? (
              <span>
                Process wins <em>{decision.good_win + decision.good_loss}</em> · lucky/bad{" "}
                <em>{decision.lucky_win + decision.bad_loss}</em>
              </span>
            ) : null}
          </div>
          <span className="cta">Open Behaviour →</span>
        </button>
      </div>
      <style jsx>{`
        .section {
          margin-bottom: 8px;
        }
        .section-title {
          margin: 0 0 4px;
          font-size: 15px;
        }
        .section-lead {
          margin: 0 0 14px;
          font-size: 14px;
          color: var(--text-muted);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 10px;
        }
        .card {
          text-align: left;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          padding: 14px 16px;
          cursor: pointer;
          color: inherit;
        }
        .card:hover {
          border-color: var(--accent);
        }
        strong {
          display: block;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .q {
          display: block;
          font-size: 12px;
          color: var(--text-muted);
          margin-bottom: 12px;
        }
        .metrics {
          display: grid;
          gap: 6px;
          font-size: 13px;
          margin-bottom: 12px;
        }
        .metrics em {
          font-style: normal;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .metrics :global(.pos),
        .metrics em.pos {
          color: var(--success);
        }
        .metrics :global(.neg),
        .metrics em.neg {
          color: var(--danger);
        }
        .muted {
          color: var(--text-muted);
          font-size: 12px;
        }
        .cta {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
        }
      `}</style>
    </section>
  );
}

/** @deprecated Prefer DecisionStrip. */
export const OverviewDecisionStrip = DecisionStrip;
