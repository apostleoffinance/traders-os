"use client";

import { Panel, Stat } from "@/components/ui";
import { money, num, signed, tone } from "@/lib/format";
import type { AnalyticsDashboard } from "@/lib/analytics";

type DrillMetric = "win_rate" | "expectancy_r" | "profit_factor" | "average_r";

export function AnalyticsOverview({
  data,
  onMetricClick,
}: {
  data: AnalyticsDashboard;
  onMetricClick?: (metric: DrillMetric) => void;
}) {
  const o = data.overview;
  const n = o.n_trades;
  return (
    <Panel title="Performance overview" right={<span className="muted">{o.evidence.label} · n={n}</span>}>
      <div className="kpis">
        <Stat label="Net P/L" value={money(o.net_pnl, data.account.currency)} tone={tone(o.net_pnl)} />
        <Stat label="Total R" value={signed(o.total_r, "R")} tone={tone(o.total_r)} />
        <ClickStat label="Expectancy" value={o.expectancy_r ? `${signed(o.expectancy_r)}R` : "-"} tone={tone(o.expectancy_r)} hint={`n = ${n} trades`} onClick={onMetricClick ? () => onMetricClick("expectancy_r") : undefined} />
        <ClickStat label="Win rate" value={o.win_rate ? `${num(o.win_rate, 1)}%` : "-"} onClick={onMetricClick ? () => onMetricClick("win_rate") : undefined} />
        <ClickStat label="Profit factor" value={o.profit_factor ? num(o.profit_factor) : "-"} onClick={onMetricClick ? () => onMetricClick("profit_factor") : undefined} />
        <ClickStat label="Average R" value={o.average_r ? `${num(o.average_r)}R` : "-"} onClick={onMetricClick ? () => onMetricClick("average_r") : undefined} />
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

function ClickStat({
  label,
  value,
  tone: t,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "warn" | "ok" | "";
  hint?: string;
  onClick?: () => void;
}) {
  if (!onClick) return <Stat label={label} value={value} tone={t} hint={hint} />;
  return (
    <button type="button" className="click-stat" onClick={onClick}>
      <Stat label={label} value={value} tone={t} hint={hint} />
      <style jsx>{`
        .click-stat {
          text-align: left;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          border-radius: 6px;
        }
        .click-stat:hover :global(.stat-value) {
          color: var(--accent);
        }
      `}</style>
    </button>
  );
}
