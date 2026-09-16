"use client";

import Link from "next/link";
import { ChartCard } from "@/components/trader/ChartCard";
import { MetricCard } from "@/components/trader/MetricCard";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { money, num } from "@/lib/format";
import { resolveVizCopy } from "@/lib/visualization";

function UtilBar({
  label,
  used,
  limit,
  pct,
  currency,
}: {
  label: string;
  used: string;
  limit: string;
  pct: string | null;
  currency: string;
}) {
  const p = Math.min(100, Math.max(0, Number(pct || 0)));
  const bar = p >= 100 ? "var(--danger)" : p >= 70 ? "var(--warning)" : "var(--success)";
  return (
    <div className="util">
      <div className="lab">
        <span>{label}</span>
        <span>
          {money(used, currency)} / {money(limit, currency)}
          {pct != null ? ` · ${num(pct, 0)}%` : ""}
        </span>
      </div>
      <div className="track" role="meter" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="fill" style={{ width: `${p}%`, background: bar }} />
      </div>
      <style jsx>{`
        .util {
          margin-bottom: 12px;
        }
        .lab {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .track {
          height: 8px;
          background: var(--surface-2);
          border: 1px solid var(--line);
          border-radius: 4px;
          overflow: hidden;
        }
        .fill {
          height: 100%;
        }
      `}</style>
    </div>
  );
}

/**
 * L1 Risk budget — same policy numbers as Risk Command / analytics.risk.
 * Decision Intelligence pattern: how much of each limit is used.
 */
export function RiskBudget({ data }: { data: AnalyticsDashboard }) {
  const r = data.risk;
  const ccy = data.account.currency;
  const copy = resolveVizCopy("risk_budget");
  const dailyPct = r.personal_daily.pct != null ? Number(r.personal_daily.pct) : null;
  const ddPct = r.personal_drawdown.pct != null ? Number(r.personal_drawdown.pct) : null;
  const hottest = Math.max(dailyPct ?? 0, ddPct ?? 0);

  return (
    <ChartCard
      title={copy.title}
      tier="essential"
      actions={
        <Link href="/risk" className="cmd">
          Risk Command →
        </Link>
      }
    >
      <div className="kpis">
        <MetricCard
          label="Status"
          value={r.status.replace(/_/g, " ").toUpperCase()}
          tone={hottest >= 70 ? "neg" : hottest >= 40 ? "warn" : "ok"}
        />
        <MetricCard label="Trades today" value={`${r.trades_today} / ${r.max_trades_per_day}`} />
        <MetricCard
          label="Avg risk (last N)"
          value={r.avg_risk_last_n != null ? money(r.avg_risk_last_n, ccy) : "—"}
        />
        <MetricCard
          label="Risk escalation"
          value={r.risk_escalation_pct != null ? `${num(r.risk_escalation_pct, 1)}%` : "—"}
          tone={
            r.risk_escalation_pct != null && Number(r.risk_escalation_pct) > 10
              ? "neg"
              : undefined
          }
        />
      </div>

      <UtilBar
        label="Personal daily loss"
        used={r.personal_daily.used}
        limit={r.personal_daily.limit}
        pct={r.personal_daily.pct}
        currency={ccy}
      />
      <UtilBar
        label="Personal max drawdown"
        used={r.personal_drawdown.used}
        limit={r.personal_drawdown.limit}
        pct={r.personal_drawdown.pct}
        currency={ccy}
      />
      <UtilBar
        label="Firm daily drawdown"
        used={r.firm_daily.used}
        limit={r.firm_daily.limit}
        pct={r.firm_daily.pct}
        currency={ccy}
      />
      <UtilBar
        label="Firm max drawdown"
        used={r.firm_drawdown.used}
        limit={r.firm_drawdown.limit}
        pct={r.firm_drawdown.pct}
        currency={ccy}
      />

      {r.reasons.length > 0 ? (
        <ul className="reasons">
          {r.reasons.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : null}

      <style jsx>{`
        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 10px;
          margin-bottom: 14px;
        }
        .reasons {
          margin: 8px 0 0;
          padding-left: 18px;
          font-size: 12px;
          color: var(--text-muted);
        }
        :global(.cmd) {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          text-decoration: none;
        }
        :global(.cmd:hover) {
          text-decoration: underline;
        }
      `}</style>
    </ChartCard>
  );
}

/** @deprecated Prefer RiskBudget — kept for Risk tab call sites. */
export const RiskBudgetPanel = RiskBudget;
