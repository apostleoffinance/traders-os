"use client";

import { useState } from "react";
import { Panel, Stat } from "@/components/ui";
import { Empty, EvidenceTag, useLiveChart } from "@/components/analytics/Charts";
import { ChartCard } from "@/components/trader";
import { ResearchTable } from "@/components/trader/tables/ResearchTable";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";
import { useOptionalAnalyticsDrilldown } from "@/components/analytics/AnalyticsDrilldownContext";
import { filterForDateRange, filterForSingleDay } from "@/lib/analytics-drilldown";
import type { AnalyticsDashboard, HistBin } from "@/lib/analytics";
import { colorForBinRange } from "@/lib/chart-colors";
import { money, num, signed, tone } from "@/lib/format";

function histOption(bins: HistBin[], label: string, C: ReturnType<typeof useLiveChart>["C"]) {
  return {
    grid: { left: 48, right: 16, top: 20, bottom: 32 },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      data: bins.map((b) => `${b.from}–${b.to}`),
      axisLabel: { fontSize: 9, rotate: 30 },
    },
    yAxis: { type: "value", name: "n", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        data: bins.map((b) => ({
          value: b.n,
          itemStyle: { color: colorForBinRange(C, b.from, b.to) },
        })),
      },
    ],
  };
}

export function DistributionLab({ data }: { data: AnalyticsDashboard }) {
  const lab = data.lab;
  const { C } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const currency = data.account.currency;
  if (!lab?.distributions) return null;
  const d = lab.distributions;
  const exp = d.expectancy;

  function histClick(bins: HistBin[], e: { dataIndex?: number }, label: string) {
    if (!drill || e.dataIndex == null) return;
    const bin = bins[e.dataIndex];
    if (!bin) return;
    const mid = (bin.from + bin.to) / 2;
    const result = mid > 0 ? "win" : mid < 0 ? "loss" : "breakeven";
    drill.applyPatch({ result }, `${bin.from}–${bin.to}`);
    drill.openTrades(`${label} bin ${bin.from}–${bin.to}`);
  }

  return (
  <>
    <ChartCard title="Trade P&L distribution" sampleSize={d.trade_pnl.n} evidenceLabel={d.trade_pnl.evidence.label} interactive>
      {d.trade_pnl.n === 0 ? (
        <Empty>No closed trades match the selected filters.</Empty>
      ) : (
        <>
          <div className="stats">
            <Stat label="Mean" value={money(d.trade_pnl.mean, currency)} />
            <Stat label="Median" value={money(d.trade_pnl.median, currency)} />
            <Stat label="Std dev" value={d.trade_pnl.stdev ? money(d.trade_pnl.stdev, currency) : "—"} />
            <Stat label="P10" value={money(d.trade_pnl.percentiles?.p10, currency)} />
            <Stat label="P90" value={money(d.trade_pnl.percentiles?.p90, currency)} />
          </div>
          {d.trade_pnl.histogram.length > 0 && (
            <InteractiveChart
              option={histOption(d.trade_pnl.histogram, "P&L", C)}
              height={220}
              showHint={false}
              onChartClick={(e) => histClick(d.trade_pnl.histogram, e, "P&L")}
            />
          )}
          {d.trade_pnl.sample_note && <p className="muted">{d.trade_pnl.sample_note}</p>}
        </>
      )}
    </ChartCard>

    <ChartCard title="R-multiple distribution" sampleSize={d.r_multiple.n} evidenceLabel={d.r_multiple.evidence?.label} interactive>
      {d.r_multiple.n === 0 ? (
        <Empty>R-based analytics require valid initial risk data.</Empty>
      ) : (
        <>
          <div className="stats">
            <Stat label="Mean R" value={signed(d.r_multiple.mean, "R")} />
            <Stat label="Median R" value={signed(d.r_multiple.median, "R")} />
            <Stat label="Min" value={signed(d.r_multiple.min, "R")} tone="neg" />
            <Stat label="Max" value={signed(d.r_multiple.max, "R")} tone="pos" />
          </div>
          {d.r_multiple.bins?.length > 0 && (
            <InteractiveChart
              option={histOption(d.r_multiple.bins, "R", C)}
              height={220}
              showHint={false}
              onChartClick={(e) => histClick(d.r_multiple.bins, e, "R")}
            />
          )}
        </>
      )}
    </ChartCard>

    <Panel title="Expectancy" right={<EvidenceTag n={exp.n} label={exp.evidence.label} />}>
      <div className="stats">
        <Stat label="Per trade" value={exp.expectancy_currency ? money(exp.expectancy_currency, currency) : "—"} />
        <Stat label="Expectancy R" value={exp.expectancy_r ? `${signed(exp.expectancy_r)}R` : "—"} />
        <Stat label="Avg R" value={exp.average_r ? `${num(exp.average_r)}R` : "—"} hint={exp.valid_r_observations != null ? `R recorded for ${exp.valid_r_observations} trade${exp.valid_r_observations === 1 ? "" : "s"}` : undefined} />
        <Stat label="Total R" value={exp.total_r ? `${signed(exp.total_r)}R` : "—"} />
      </div>
      {exp.missing_r > 0 && <p className="muted">Missing R on {exp.missing_r} trades.</p>}
    </Panel>

    <ChartCard title="Daily P&L distribution" sampleSize={d.daily_pnl.trading_days} interactive>
      <div className="stats">
        <Stat label="Trading days" value={String(d.daily_pnl.trading_days)} />
        <Stat label="Profitable" value={String(d.daily_pnl.profitable_days)} tone="pos" />
        <Stat label="Losing" value={String(d.daily_pnl.losing_days)} tone="neg" />
        <Stat label="Flat" value={String(d.daily_pnl.flat_days)} />
        <Stat label="Avg daily" value={money(d.daily_pnl.mean, currency)} tone={tone(d.daily_pnl.mean)} />
        <Stat label="Best day" value={money(d.daily_pnl.max, currency)} tone="pos" />
        <Stat label="Worst day" value={money(d.daily_pnl.min, currency)} tone="neg" />
      </div>
      {d.daily_pnl.histogram.length > 0 && (
        <InteractiveChart
          option={histOption(d.daily_pnl.histogram, "Daily", C)}
          height={200}
          showHint={false}
          onChartClick={(e) => histClick(d.daily_pnl.histogram, e, "Daily P&L")}
        />
      )}
    </ChartCard>

    <style jsx>{`
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 12px;
        margin-bottom: 12px;
      }
      .muted {
        font-size: 13px;
        margin-top: 8px;
      }
    `}</style>
  </>
  );
}

export function ConsistencyLab({ data }: { data: AnalyticsDashboard }) {
  const c = data.lab?.consistency;
  if (!c) return null;
  const currency = data.account.currency;
  return (
    <Panel title="Performance consistency" right={<EvidenceTag label={c.evidence.label} n={c.trading_days} />}>
      <div className="stats">
        <Stat label="Winning days %" value={c.winning_days_pct ? `${num(c.winning_days_pct, 1)}%` : "—"} />
        <Stat label="Winning weeks %" value={c.winning_weeks_pct ? `${num(c.winning_weeks_pct, 1)}%` : "—"} />
        <Stat label="Positive months %" value={c.positive_months_pct ? `${num(c.positive_months_pct, 1)}%` : "—"} />
        <Stat label="Avg daily P&L" value={money(c.average_daily_pnl, currency)} tone={tone(c.average_daily_pnl)} />
        <Stat label="Median daily P&L" value={money(c.median_daily_pnl, currency)} />
        <Stat label="Daily volatility" value={c.daily_pnl_volatility ? money(c.daily_pnl_volatility, currency) : "—"} />
        <Stat label="Largest win day" value={money(c.largest_winning_day, currency)} tone="pos" />
        <Stat
          label="Largest loss day"
          value={c.losing_days > 0 ? money(c.largest_losing_day, currency) : "—"}
          tone={c.losing_days > 0 ? "neg" : ""}
        />
      </div>
      {c.sample_note && <p className="muted">{c.sample_note}</p>}
      <style jsx>{`
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
        }
        .muted {
          font-size: 13px;
          margin-top: 8px;
        }
      `}</style>
    </Panel>
  );
}

export function StreakLab({ data }: { data: AnalyticsDashboard }) {
  const s = data.lab?.streaks;
  if (!s) return null;
  const currency = data.account.currency;
  return (
    <>
      <Panel title="Streak summary" right={<EvidenceTag label={s.evidence.label} n={s.n} />}>
        <div className="stats">
          <Stat label="Current wins" value={String(s.current.wins)} />
          <Stat label="Current losses" value={String(s.current.losses)} tone={s.current.losses > 0 ? "neg" : undefined} />
          <Stat label="Longest win" value={String(s.longest.wins)} tone="pos" />
          <Stat label="Longest loss" value={String(s.longest.losses)} tone="neg" />
          <Stat label="Avg win streak" value={s.averages.average_win_streak ?? "—"} />
          <Stat label="Avg loss streak" value={s.averages.average_loss_streak ?? "—"} />
        </div>
        <p className="muted">{s.breakeven_rule}</p>
      </Panel>
      {s.after_streaks.map((row) => (
        <Panel key={row.key} title={`After-streak · ${row.key}`} right={<EvidenceTag n={row.n} />}>
          {row.n === 0 ? (
            <Empty>Insufficient occurrences in this sample.</Empty>
          ) : (
            <div className="stats">
              <Stat label="Win rate" value={row.win_rate ? `${num(row.win_rate, 1)}%` : "—"} />
              <Stat label="Avg R" value={row.average_r ? `${num(row.average_r)}R` : "—"} />
              <Stat label="Net P&L" value={money(row.net_pnl, currency)} tone={tone(row.net_pnl)} />
            </div>
          )}
          {row.insight && <p className="muted">{row.insight}</p>}
        </Panel>
      ))}
      <style jsx>{`
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
        }
        .muted {
          font-size: 13px;
          margin-top: 8px;
        }
      `}</style>
    </>
  );
}

export function RiskAnalyticsLab({ data }: { data: AnalyticsDashboard }) {
  const r = data.lab?.risk_analytics;
  const currency = data.account.currency;
  if (!r) return null;
  const c = r.consistency;
  return (
    <>
      <Panel title="Risk distribution" right={<EvidenceTag n={r.distribution.risk_amount.n} />}>
        <div className="stats">
          <Stat label="Avg risk" value={money(r.distribution.risk_amount.mean, currency)} />
          <Stat label="Median" value={money(r.distribution.risk_amount.median, currency)} />
          <Stat label="Min" value={money(r.distribution.risk_amount.min, currency)} />
          <Stat label="Max" value={money(r.distribution.risk_amount.max, currency)} />
        </div>
        {r.distribution.missing_risk > 0 && <p className="muted">Missing risk on {r.distribution.missing_risk} trades.</p>}
      </Panel>
      <Panel title="Risk consistency">
        <div className="stats">
          <Stat label="Configured" value={money(c.configured_risk, currency)} />
          <Stat label="Avg actual" value={money(c.average_actual_risk, currency)} />
          <Stat label="Deviation" value={c.deviation_pct ? `${signed(c.deviation_pct)}%` : "—"} />
        </div>
      </Panel>
      <Panel title="Risk vs outcome">
        <ResearchTable
          rows={r.risk_vs_outcome}
          columns={[
            { id: "bucket", header: "Bucket", accessor: (row) => row.bucket },
            { id: "n", header: "n", accessor: (row) => row.n, numeric: true },
            {
              id: "wr",
              header: "Win %",
              accessor: (row) => (row.win_rate ? `${num(row.win_rate, 1)}%` : "—"),
              numeric: true,
            },
            {
              id: "avg_r",
              header: "Avg R",
              accessor: (row) => (row.average_r ? `${num(row.average_r)}R` : "—"),
              numeric: true,
            },
            {
              id: "pnl",
              header: "Net P&L",
              accessor: (row) => (row.net_pnl ? money(row.net_pnl, currency) : "—"),
              numeric: true,
            },
          ]}
          getRowId={(row) => row.bucket}
          caption="Risk vs outcome"
        />
      </Panel>
      {r.escalation.length > 0 && (
        <Panel title="Risk behaviour (descriptive)">
          <ul className="list">
            {r.escalation.map((e) => (
              <li key={e.context}>{e.wording}</li>
            ))}
          </ul>
        </Panel>
      )}
      <style jsx>{`
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
        }
        .muted,
        .list {
          font-size: 13px;
        }
      `}</style>
    </>
  );
}

export function PeriodComparisonLab({ data }: { data: AnalyticsDashboard }) {
  const pc = data.lab?.temporal?.period_comparison;
  if (!pc?.available) return null;
  return (
    <Panel title="Period comparison">
      <p className="muted">{pc.disclaimer}</p>
      <ResearchTable
        rows={pc.comparison}
        columns={[
          { id: "metric", header: "Metric", accessor: (r) => r.metric },
          { id: "current", header: "Current", accessor: (r) => r.current ?? "—" },
          { id: "previous", header: "Previous", accessor: (r) => r.previous ?? "—" },
          { id: "change", header: "Change", accessor: (r) => r.change ?? "—" },
        ]}
        getRowId={(r) => r.metric}
        caption="Period comparison"
      />
      <style jsx>{`
        .muted {
          font-size: 13px;
          margin-bottom: 8px;
        }
      `}</style>
    </Panel>
  );
}

export function TemporalLab({
  data,
  variant = "all",
}: {
  data: AnalyticsDashboard;
  variant?: "essential" | "deep" | "all";
}) {
  const showEssential = variant === "essential" || variant === "all";
  const showDeep = variant === "deep" || variant === "all";
  const t = data.lab?.temporal;
  const [calMetric, setCalMetric] = useState<"r" | "net_pnl" | "n">("r");
  const { C, resolved } = useLiveChart();
  const drill = useOptionalAnalyticsDrilldown();
  const currency = data.account.currency;
  if (!t) return null;

  const days = t.calendar.days;
  const maxAbs = Math.max(
    ...days.map((d) => Math.abs(Number(calMetric === "r" ? d.r ?? 0 : calMetric === "net_pnl" ? d.net_pnl : d.n))),
    1,
  );

  const weekdayChart = {
    grid: { left: 88, right: 16, top: 16, bottom: 32 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
    yAxis: {
      type: "category",
      data: t.weekday.map((w) => w.key),
      inverse: true,
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: "bar",
        data: t.weekday.map((w) => ({
          value: Number(w.net_pnl ?? 0),
          itemStyle: { color: Number(w.net_pnl ?? 0) >= 0 ? C.pos : C.neg },
        })),
      },
    ],
  };

  const monthlyChart = {
    grid: { left: 48, right: 16, top: 16, bottom: 40 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: t.monthly.rows.map((m) => m.month), axisLabel: { rotate: 35, fontSize: 10 } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: C.line } } },
    series: [
      {
        type: "bar",
        data: t.monthly.rows.map((m) => ({
          value: Number(m.net_pnl),
          itemStyle: { color: Number(m.net_pnl) >= 0 ? C.pos : C.neg },
        })),
      },
    ],
  };

  return (
    <>
      {showEssential && (
      <ChartCard
        title="Calendar"
        question="Which days contributed most to my results?"
        tier="essential"
        interactive
        actions={
          <div className="modes" role="group" aria-label="Calendar metric">
            {(["r", "net_pnl", "n"] as const).map((m) => (
              <button key={m} type="button" className={calMetric === m ? "on" : ""} aria-pressed={calMetric === m} onClick={() => setCalMetric(m)}>
                {m === "r" ? "Daily R" : m === "net_pnl" ? "Net P&L" : "Trades"}
              </button>
            ))}
          </div>
        }
      >
        {days.length === 0 ? (
          <Empty>No trading days in this period.</Empty>
        ) : (
          <div className="cal">
              {days.map((d) => {
                const val = calMetric === "r" ? Number(d.r ?? 0) : calMetric === "net_pnl" ? Number(d.net_pnl) : d.n;
                const intensity = Math.min(1, Math.abs(val) / maxAbs);
                const pos = resolved === "dark" ? "24,185,129" : "8,127,91";
                const neg = resolved === "dark" ? "229,107,111" : "199,68,75";
                const bg =
                  calMetric === "n"
                    ? `rgba(${pos},${0.1 + intensity * 0.5})`
                    : val >= 0
                      ? `rgba(${pos},${0.15 + intensity * 0.7})`
                      : `rgba(${neg},${0.15 + intensity * 0.7})`;
                return (
                  <button
                    key={d.date}
                    type="button"
                    className="cell"
                    style={{ background: bg }}
                    title={`${d.date} · ${d.record} · n=${d.n}`}
                    onClick={() => {
                      if (!drill) return;
                      drill.applyPatch(filterForSingleDay(d.date), d.date);
                      drill.openTrades(`Trades on ${d.date}`);
                    }}
                  >
                    <span className="d">{d.date.slice(8)}</span>
                    <span className="v">
                      {calMetric === "r" ? (d.r != null ? `${num(d.r, 1)}R` : "—") : calMetric === "net_pnl" ? money(d.net_pnl, currency) : String(d.n)}
                    </span>
                  </button>
                );
              })}
            </div>
        )}
      </ChartCard>
      )}

      {showDeep && (
      <>
      <ChartCard title="Day of week" question="Which weekdays show stronger net results?" tier="deep_dive" interactive>
        {t.weekday.every((w) => w.n === 0) ? (
          <Empty>No weekday breakdown available.</Empty>
        ) : (
          <>
            <InteractiveChart
              option={weekdayChart}
              height={Math.max(180, t.weekday.length * 36 + 48)}
              showHint={false}
              onChartClick={(e) => {
                if (!drill || e.dataIndex == null) return;
                const row = t.weekday[e.dataIndex];
                drill.openTrades(`${row.key} · ${row.n} trades`);
              }}
            />
            <table className="tbl">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>n</th>
                  <th>Win %</th>
                  <th>Net P&L</th>
                  <th>Avg R</th>
                </tr>
              </thead>
              <tbody>
                {t.weekday.map((w) => (
                  <tr key={w.key}>
                    <td>{w.key}</td>
                    <td>{w.n}</td>
                    <td>{w.win_rate ? `${num(w.win_rate, 1)}%` : "—"}</td>
                    <td>{w.net_pnl ? money(w.net_pnl, currency) : "—"}</td>
                    <td>{w.average_r ? `${num(w.average_r)}R` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </ChartCard>

      <ChartCard title="Monthly performance" interactive>
        {t.monthly.rows.length === 0 ? (
          <Empty>No monthly rows in this period.</Empty>
        ) : (
          <>
            <InteractiveChart
              option={monthlyChart}
              height={240}
              showHint={false}
              onChartClick={(e) => {
                if (!drill || e.dataIndex == null) return;
                const row = t.monthly.rows[e.dataIndex];
                const [year, month] = row.month.split("-");
                const lastDay = new Date(Number(year), Number(month), 0).getDate();
                const from = `${row.month}-01`;
                const to = `${row.month}-${String(lastDay).padStart(2, "0")}`;
                drill.applyPatch(filterForDateRange(from, to), row.month);
                drill.openTrades(`Trades in ${row.month}`);
              }}
            />
            <table className="tbl">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>n</th>
                  <th>Win %</th>
                  <th>Net P&L</th>
                  <th>PF</th>
                </tr>
              </thead>
              <tbody>
                {t.monthly.rows.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td>{m.n}</td>
                    <td>{m.win_rate ? `${num(m.win_rate, 1)}%` : "—"}</td>
                    <td>{money(m.net_pnl, currency)}</td>
                    <td>{m.profit_factor ? num(m.profit_factor) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </ChartCard>

      {t.period_comparison.available && <PeriodComparisonLab data={data} />}
      </>
      )}

      <style jsx>{`
        .modes {
          display: flex;
          gap: 4px;
        }
        .modes button {
          font-size: 11px;
          padding: 4px 8px;
          border: 1px solid var(--line);
          background: transparent;
          cursor: pointer;
        }
        .modes button.on {
          background: var(--line);
        }
        .cal {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
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
        .v {
          font-family: "IBM Plex Mono", monospace;
          font-size: 10px;
        }
        .tbl {
          width: 100%;
          font-size: 12px;
          border-collapse: collapse;
        }
        .tbl th,
        .tbl td {
          border: 1px solid var(--line);
          padding: 6px 8px;
        }
        .muted {
          font-size: 13px;
          margin-bottom: 8px;
        }
      `}</style>
    </>
  );
}
