"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Panel, Stat } from "@/components/ui";
import { holdingLabel, money, num, sessionLabel, signed, tone } from "@/lib/format";
import {
  type AnalyticsDashboard,
  type GroupRow,
  type MetricKey,
} from "@/lib/analytics";
import { filterForDateRange, filterForSingleDay } from "@/lib/analytics-drilldown";
import { linearRegression } from "@/lib/chart-regression";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { Empty, EvidenceTag, HorizontalBars, MetricToggle, sessionName, useLiveChart } from "@/components/analytics/Charts";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type GroupDimension = "session" | "setup" | "psychology" | "weekday";

function GroupBlock({
  title,
  subtitle,
  rows,
  labelFn,
  dimension,
  setupIdForName,
}: {
  title: string;
  subtitle: string;
  rows: GroupRow[];
  labelFn?: (k: string) => string;
  dimension: GroupDimension;
  setupIdForName?: (name: string) => string | undefined;
}) {
  const [metric, setMetric] = useState<MetricKey>("expectancy_r");
  const drill = useOptionalAnalyticsDrilldown();

  function handleRowClick(row: GroupRow) {
    if (!drill) return;
    const label = labelFn ? labelFn(row.key) : row.key;
    if (dimension === "session") {
      drill.applyPatch({ session: row.key }, label);
    } else if (dimension === "psychology") {
      drill.applyPatch({ psychology: row.key }, label);
    } else if (dimension === "setup") {
      const id = setupIdForName?.(row.key);
      if (id) drill.applyPatch({ setup_id: id }, label);
    } else if (dimension === "weekday") {
      return;
    }
    drill.openTrades(`${title}: ${label}`);
  }

  return (
    <ChartCard title={title} actions={<MetricToggle value={metric} onChange={setMetric} />} subtitle={subtitle} interactive>
      <HorizontalBars rows={rows} metric={metric} labelFn={labelFn} onRowClick={drill ? handleRowClick : undefined} />
    </ChartCard>
  );
}

export function SessionSetupPsych({ data }: { data: AnalyticsDashboard }) {
  const weekday = useMemo(() => {
    const map = new Map(data.weekday.map((r) => [r.key, r]));
    return WEEKDAYS.map((d) => map.get(d)).filter(Boolean) as GroupRow[];
  }, [data.weekday]);
  const setupIdForName = (name: string) => data.filters.options?.setups.find((s) => s.name === name)?.id;
  return (
    <>
      <GroupBlock
        title="Session performance"
        subtitle="Click a bar to filter analytics and view trades."
        rows={data.sessions}
        labelFn={sessionName}
        dimension="session"
      />
      <GroupBlock
        title="Setup performance"
        subtitle="Historical setup results. Not a recommendation to trade a pattern."
        rows={data.setups}
        dimension="setup"
        setupIdForName={setupIdForName}
      />
      <GroupBlock
        title="Psychology & behavior"
        subtitle="Click a bar to filter by emotional state."
        rows={data.psychology}
        dimension="psychology"
      />
      <GroupBlock title="Day of week" subtitle="Average outcomes by weekday in your timezone." rows={weekday} dimension="weekday" />
    </>
  );
}

export function Distribution({ data }: { data: AnalyticsDashboard }) {
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const dist = data.r_distribution;
  const hist = {
    grid: { left: 44, right: 16, top: 16, bottom: 32 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: dist.bins.map((b) => `${num(b.from, 1)}–${num(b.to, 1)}`),
      axisLabel: { fontSize: 9, rotate: 40, color: C.muted },
    },
    yAxis: { type: "value", name: "n", axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        data: dist.bins.map((b) => ({
          value: b.n,
          itemStyle: { color: b.from + b.to >= 0 ? C.pos : C.neg },
        })),
        barWidth: "70%",
      },
    ],
  };
  const freqMetric = "expectancy_r" as MetricKey;
  return (
    <>
      <ChartCard
        title="R distribution"
        sampleSize={dist.n}
        evidenceLabel={dist.evidence.label}
        subtitle={`Mean ${dist.mean ?? "-"}R · median ${dist.median ?? "-"}R · min ${dist.min ?? "-"}R · max ${dist.max ?? "-"}R`}
        interactive
      >
        {dist.n < 2 ? (
          <Empty>Add more closed trades to see the R distribution.</Empty>
        ) : (
          <InteractiveChart
            option={hist}
            height={240}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || e.dataIndex == null) return;
              const bin = dist.bins[e.dataIndex];
              const mid = (bin.from + bin.to) / 2;
              const result = mid > 0 ? "win" : mid < 0 ? "loss" : "breakeven";
              drill.applyPatch({ result }, `${bin.from}–${bin.to}R`);
              drill.openTrades(`R bin ${bin.from}–${bin.to}`);
            }}
          />
        )}
      </ChartCard>
      <ChartCard
        title="Trades per day"
        subtitle="Does expectancy change when you trade more than once? Historical association only."
        interactive
      >
        <HorizontalBars rows={data.frequency} metric={freqMetric} labelFn={(k) => (k === "4+" ? "4+ / day" : `${k} / day`)} />
      </ChartCard>
    </>
  );
}

export function Scatters({ data }: { data: AnalyticsDashboard }) {
  const { C } = useLiveChart();
  const router = useRouter();
  const risk = data.risk_vs_result;
  const hold = data.holding_vs_result;

  const riskRegression = useMemo(
    () => linearRegression(risk.map((d) => ({ x: Number(d.risk_percent), y: Number(d.realized_r) }))),
    [risk],
  );

  const riskOpt = {
    grid: { left: 44, right: 16, top: 16, bottom: 40 },
    tooltip: {
      trigger: "item",
      formatter: (p: { data: { symbol: string; result: string; value: [number, number] } }) =>
        `${p.data.symbol} ${p.data.result}<br/>Risk ${num(p.data.value[0], 3)}% · ${num(p.data.value[1])}R`,
    },
    xAxis: { name: "Risk %", type: "value", axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: C.line } } },
    yAxis: { name: "R", type: "value", axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        name: "Trades",
        type: "scatter",
        symbolSize: 9,
        data: risk.map((d) => ({
          value: [Number(d.risk_percent), Number(d.realized_r)],
          tradeId: d.id,
          symbol: d.symbol,
          result: d.result,
          itemStyle: { color: Number(d.realized_r) >= 0 ? C.pos : C.neg },
        })),
      },
      ...(riskRegression
        ? [
            {
              name: "Trend",
              type: "line",
              data: riskRegression.line,
              showSymbol: false,
              lineStyle: { type: "dashed", color: C.muted, width: 1.5 },
              tooltip: { show: false },
            },
          ]
        : []),
    ],
  };

  const holdOpt = {
    grid: { left: 44, right: 16, top: 16, bottom: 40 },
    tooltip: {
      trigger: "item",
      formatter: (p: { data: { setup: string; session: string; value: [number, number] } }) =>
        `${p.data.setup} · ${sessionLabel(p.data.session)}<br/>${holdingLabel(p.data.value[0] * 60)} · ${num(p.data.value[1])}R`,
    },
    xAxis: { name: "Minutes", type: "value", axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: C.line } } },
    yAxis: { name: "R", type: "value", axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        name: "Trades",
        type: "scatter",
        symbolSize: 9,
        data: hold.map((d) => ({
          value: [d.holding_seconds / 60, Number(d.realized_r)],
          tradeId: d.id,
          setup: d.setup,
          session: d.session,
          itemStyle: { color: Number(d.realized_r) >= 0 ? C.pos : C.neg },
        })),
      },
    ],
  };

  function handleTradeClick(params: { seriesName?: string; data?: unknown }) {
    const row = params.data as { tradeId?: string } | undefined;
    if (params.seriesName === "Trades" && row?.tradeId) {
      router.push(`/trades/${row.tradeId}`);
    }
  }

  return (
    <div className="two">
      <ChartCard title="Risk vs result" subtitle="Each point is a trade. Dashed line is descriptive trend only." interactive>
        {risk.length ? (
          <InteractiveChart option={riskOpt} height={280} showHint={false} onChartClick={handleTradeClick} />
        ) : (
          <Empty>No closed trades with risk data.</Empty>
        )}
      </ChartCard>
      <ChartCard title="Holding time vs result" subtitle="Investigate over-holding losers or cutting winners early." interactive>
        {hold.length ? (
          <InteractiveChart option={holdOpt} height={280} showHint={false} onChartClick={handleTradeClick} />
        ) : (
          <Empty>No holding times recorded.</Empty>
        )}
      </ChartCard>
      <style jsx>{`
        .two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 900px) {
          .two {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export function CalendarHeat({ data }: { data: AnalyticsDashboard }) {
  const { resolved } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const days = data.calendar;
  if (!days.length) {
    return (
      <Panel title="Calendar">
        <Empty>No trading days in this filter.</Empty>
      </Panel>
    );
  }
  const maxAbs = Math.max(...days.map((d) => Math.abs(Number(d.r || 0))), 0.01);
  return (
    <ChartCard title="Calendar performance" hint="Color is daily R. Click a day to filter the full analytics view." interactive>
      <div className="cal">
        {days.map((d) => {
          const r = Number(d.r || 0);
          const t = Math.min(1, Math.abs(r) / maxAbs);
          const pos = resolved === "dark" ? "24,185,129" : "8,127,91";
          const neg = resolved === "dark" ? "229,107,111" : "199,68,75";
          const bg = r >= 0 ? `rgba(${pos},${0.15 + t * 0.7})` : `rgba(${neg},${0.15 + t * 0.7})`;
          return (
            <button
              key={d.date}
              type="button"
              className="cell"
              style={{ background: bg }}
              title={`${d.date} · n=${d.n} · ${d.r ?? "-"}R · ${d.net_pnl}`}
              onClick={() => {
                if (!drill) return;
                drill.applyPatch(filterForSingleDay(d.date), d.date);
                drill.openTrades(`Trades on ${d.date}`);
              }}
            >
              <span className="d">{d.date.slice(8)}</span>
              <span className="r">{d.r != null ? num(d.r, 1) : "-"}</span>
            </button>
          );
        })}
      </div>
      <style jsx>{`
        .cal {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
          gap: 4px;
        }
        .cell {
          border: 1px solid var(--line);
          padding: 6px 4px;
          min-height: 44px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          cursor: pointer;
        }
        .cell:hover {
          outline: 2px solid var(--accent);
        }
        .d {
          font-size: 10px;
          color: var(--muted);
        }
        .r {
          font-family: "IBM Plex Mono", monospace;
          font-size: 11px;
        }
      `}</style>
    </ChartCard>
  );
}

export function MonthlyRolling({ data }: { data: AnalyticsDashboard }) {
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const months = data.monthly;
  const roll = data.rolling_expectancy;
  const monthOpt = {
    grid: { left: 48, right: 16, top: 20, bottom: 32 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: months.map((m) => m.month || m.key), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", name: "R", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        data: months.map((m) => ({
          value: Number(m.expectancy_r || 0),
          itemStyle: { color: Number(m.expectancy_r || 0) >= 0 ? C.pos : C.neg },
        })),
      },
    ],
  };
  const rollOpt = {
    grid: { left: 48, right: 16, top: 20, bottom: 32 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: roll.map((p) => p.at.slice(0, 10)), axisLabel: { fontSize: 10 } },
    yAxis: { type: "value", name: "Exp R", splitLine: { lineStyle: { color: C.line } } },
    series: [{ type: "line", showSymbol: false, data: roll.map((p) => Number(p.expectancy_r)), lineStyle: { color: C.blue, width: 1.5 } }],
  };
  return (
    <div className="two">
      <ChartCard title="Monthly expectancy" interactive>
        {months.length ? (
          <InteractiveChart
            option={monthOpt}
            height={240}
            showHint={false}
            onChartClick={(e) => {
              if (!drill || e.dataIndex == null) return;
              const row = months[e.dataIndex];
              const month = row.month || row.key;
              const [year, mo] = month.split("-");
              const lastDay = new Date(Number(year), Number(mo), 0).getDate();
              drill.applyPatch(filterForDateRange(`${month}-01`, `${month}-${String(lastDay).padStart(2, "0")}`), month);
              drill.openTrades(`Trades in ${month}`);
            }}
          />
        ) : (
          <Empty>Need trades across months.</Empty>
        )}
      </ChartCard>
      <ChartCard title="Rolling 20-trade expectancy" subtitle="Short windows are noisy. Do not overinterpret.">
        {roll.length > 2 ? <InteractiveChart option={rollOpt} height={240} showHint={false} /> : <Empty>Need more trades for a rolling window.</Empty>}
      </ChartCard>
      <style jsx>{`
        .two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 900px) {
          .two {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export function StreaksConsistency({ data }: { data: AnalyticsDashboard }) {
  const { C } = useLiveChart();
  const s = data.streaks;
  const c = data.consistency;
  const lossOpt = {
    grid: { left: 36, right: 12, top: 12, bottom: 28 },
    xAxis: { type: "category", data: s.loss_distribution.map((x) => `${x.length}`), name: "Length" },
    yAxis: { type: "value", name: "n" },
    series: [{ type: "bar", data: s.loss_distribution.map((x) => x.occurrences), itemStyle: { color: C.neg } }],
    tooltip: { trigger: "axis" },
  };
  return (
    <div className="two">
      <ChartCard title="Streaks" sampleSize={s.evidence.n} evidenceLabel={s.evidence.label} subtitle="Losing streak lengths (historical). Not a stop-trading rule." interactive>
        <div className="kpis">
          <Stat label="Current wins" value={String(s.current_wins)} />
          <Stat label="Current losses" value={String(s.current_losses)} />
          <Stat label="Longest wins" value={String(s.longest_wins)} />
          <Stat label="Longest losses" value={String(s.longest_losses)} />
        </div>
        {s.loss_distribution.length ? (
          <InteractiveChart option={lossOpt} height={180} showHint={false} />
        ) : (
          <Empty>No closed streaks yet.</Empty>
        )}
      </ChartCard>
      <ChartCard title="Consistency" sampleSize={c.trading_days} evidenceLabel={c.evidence.label}>
        <div className="kpis">
          <Stat label="Profitable days" value={c.profitable_day_pct ? `${num(c.profitable_day_pct, 1)}%` : "-"} />
          <Stat label="Avg daily R" value={c.average_daily_r ? `${signed(c.average_daily_r)}R` : "-"} tone={tone(c.average_daily_r)} />
          <Stat label="Median daily R" value={c.median_daily_r ? `${num(c.median_daily_r)}R` : "-"} />
          <Stat label="StDev daily R" value={c.stdev_daily_r ? num(c.stdev_daily_r) : "-"} />
          <Stat label="Best day" value={c.best_day?.r ? `${c.best_day.date} ${num(c.best_day.r)}R` : "-"} />
          <Stat label="Worst day" value={c.worst_day?.r ? `${c.worst_day.date} ${num(c.worst_day.r)}R` : "-"} />
          <Stat label="Profitable weeks" value={`${c.profitable_weeks} / ${c.weeks}`} />
        </div>
      </ChartCard>
      <style jsx>{`
        .two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .kpis {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 10px;
        }
        @media (max-width: 900px) {
          .two {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function Util({ label, used, limit, pct, currency }: { label: string; used: string; limit: string; pct: string | null; currency: string }) {
  const p = Math.min(100, Math.max(0, Number(pct || 0)));
  const bar = p >= 100 ? "var(--danger)" : p >= 70 ? "var(--warning)" : "var(--success)";
  return (
    <div className="util">
      <div className="lab">
        {label}
        <span>
          {money(used, currency)} / {money(limit, currency)} {pct != null ? `· ${num(pct, 0)}%` : ""}
        </span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${p}%`, background: bar }} />
      </div>
      <style jsx>{`
        .util {
          margin-bottom: 10px;
        }
        .lab {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .track {
          height: 8px;
          background: var(--surface-2);
          border: 1px solid var(--line);
        }
        .fill {
          height: 100%;
        }
      `}</style>
    </div>
  );
}

export function RiskAndObservations({ data }: { data: AnalyticsDashboard }) {
  const r = data.risk;
  const ccy = data.account.currency;
  return (
    <div className="two">
      <Panel title="Risk utilization" right={<span className="muted">{r.status.toUpperCase()}</span>}>
        <p className="muted">From this account’s stored risk policy. The risk engine is authoritative.</p>
        <Util label="Personal daily loss" used={r.personal_daily.used} limit={r.personal_daily.limit} pct={r.personal_daily.pct} currency={ccy} />
        <Util label="Personal max drawdown" used={r.personal_drawdown.used} limit={r.personal_drawdown.limit} pct={r.personal_drawdown.pct} currency={ccy} />
        <Util label="Firm daily drawdown" used={r.firm_daily.used} limit={r.firm_daily.limit} pct={r.firm_daily.pct} currency={ccy} />
        <Util label="Firm max drawdown" used={r.firm_drawdown.used} limit={r.firm_drawdown.limit} pct={r.firm_drawdown.pct} currency={ccy} />
        {r.reasons.map((x) => (
          <p key={x} className="muted">
            {x}
          </p>
        ))}
      </Panel>
      <Panel title="Key observations">
        <p className="muted">Deterministic. Every claim includes sample size. This is not trading advice.</p>
        <ul>
          {data.observations.map((o) => (
            <li key={o.title}>
              <strong>{o.title}</strong>
              <p>{o.text}</p>
              <span className="muted">
                {o.evidence.label} · n={o.sample_size} · {o.metric}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <style jsx>{`
        .two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 12px;
        }
        li p {
          margin: 4px 0;
        }
        @media (max-width: 900px) {
          .two {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
