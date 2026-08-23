"use client";

import { Panel, Stat } from "@/components/ui";
import { money, num, signed, tone } from "@/lib/format";
import type { AnalyticsDashboard } from "@/lib/analytics";

export function AnalyticsOverview({ data }: { data: AnalyticsDashboard }) {
  const o = data.overview;
  const n = o.n_trades;
  return (
    <Panel title="Performance overview" right={<span className="muted">{o.evidence.label} · n={n}</span>}>
      <div className="kpis">
        <Stat label="Net P/L" value={money(o.net_pnl, data.account.currency)} tone={tone(o.net_pnl)} />
        <Stat label="Total R" value={signed(o.total_r, "R")} tone={tone(o.total_r)} />
        <Stat label="Expectancy" value={o.expectancy_r ? `${signed(o.expectancy_r)}R` : "-"} tone={tone(o.expectancy_r)} hint={`n = ${n} trades`} />
        <Stat label="Win rate" value={o.win_rate ? `${num(o.win_rate, 1)}%` : "-"} />
        <Stat label="Profit factor" value={o.profit_factor ? num(o.profit_factor) : "-"} />
        <Stat label="Average R" value={o.average_r ? `${num(o.average_r)}R` : "-"} />
        <Stat label="Max drawdown" value={money(o.max_drawdown, data.account.currency)} tone="neg" />
        <Stat label="Current drawdown" value={money(o.current_drawdown, data.account.currency)} />
        <Stat label="Trades" value={String(n)} />
        <Stat label="Average risk" value={o.average_risk ? money(o.average_risk, data.account.currency) : "-"} />
        <Stat label="Discipline" value={o.discipline_score != null ? String(o.discipline_score) : "-"} />
      </div>
      {o.sample_note && <p className="muted">{o.sample_note}</p>}
      <style jsx>{`
        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 14px 16px;
        }
      `}</style>
    </Panel>
  );
}
