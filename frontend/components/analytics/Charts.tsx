"use client";

import { type GroupRow, type MetricKey, metricValue } from "@/lib/analytics";
import { num, sessionLabel } from "@/lib/format";
import { useTheme } from "@/components/ThemeProvider";
import { chartTheme } from "@/lib/theme";
import { colorForPnl } from "@/lib/chart-colors";
import { InteractiveChart } from "@/components/analytics/primitives/InteractiveChart";

export function useLiveChart() {
  const { resolved } = useTheme();
  return { C: chartTheme(), resolved };
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="muted">{children}</p>;
}

export function EvidenceTag({ label, n }: { label?: string; n?: number }) {
  if (!label && n == null) return null;
  const count =
    n != null ? ` · ${n} trade${n === 1 ? "" : "s"}` : "";
  const title =
    n != null
      ? `This metric is based on ${n} trade${n === 1 ? "" : "s"} in the selected period.`
      : undefined;
  return (
    <span className="muted" style={{ fontSize: 11 }} title={title}>
      {label}
      {count}
    </span>
  );
}

const METRICS: { id: MetricKey; label: string }[] = [
  { id: "expectancy_r", label: "Expectancy" },
  { id: "net_pnl", label: "Net P/L" },
  { id: "average_r", label: "Average R" },
  { id: "win_rate", label: "Win rate" },
  { id: "n", label: "Trade count" },
];

function formatMetric(metric: MetricKey, v: number | null): string {
  if (v === null) return "-";
  if (metric === "n") return String(v);
  if (metric === "win_rate") return `${num(v, 1)}%`;
  if (metric === "net_pnl") return v.toFixed(2);
  return `${num(v)}R`;
}

export function MetricToggle({
  value,
  onChange,
}: {
  value: MetricKey;
  onChange: (m: MetricKey) => void;
}) {
  return (
    <div className="toggles">
      {METRICS.map((m) => (
        <button key={m.id} type="button" className={value === m.id ? "on" : ""} onClick={() => onChange(m.id)}>
          {m.label}
        </button>
      ))}
      <style jsx>{`
        .toggles {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        button {
          border: 1px solid var(--line-strong);
          background: transparent;
          padding: 3px 8px;
          font-size: 11px;
        }
        .on {
          background: var(--accent);
          color: var(--accent-contrast);
          border-color: var(--accent);
        }
      `}</style>
    </div>
  );
}

export function HorizontalBars({
  rows,
  metric,
  labelFn,
  onRowClick,
}: {
  rows: GroupRow[];
  metric: MetricKey;
  labelFn?: (key: string) => string;
  onRowClick?: (row: GroupRow) => void;
}) {
  const { C } = useLiveChart();
  if (!rows.length) return <Empty>No trades available for this filter.</Empty>;
  const labeled = rows.map((r) => ({
    ...r,
    name: labelFn ? labelFn(r.key) : r.key,
    value: metricValue(r, metric),
  }));
  const option = {
    grid: { left: 110, right: 72, top: 8, bottom: 24 },
    tooltip: {
      trigger: "axis",
      formatter: (params: { dataIndex: number }[]) => {
        const i = params[0]?.dataIndex ?? 0;
        const r = labeled[i];
        return `${r.name}<br/>${formatMetric(metric, r.value)}<br/>n=${r.n} · ${r.evidence.label}${onRowClick ? "<br/><i>Click to filter</i>" : ""}`;
      },
    },
    xAxis: {
      type: "value",
      axisLabel: { fontSize: 10, color: C.muted },
      splitLine: { lineStyle: { color: C.line } },
    },
    yAxis: {
      type: "category",
      data: labeled.map((r) => r.name),
      axisLabel: { fontSize: 11, color: C.ink },
      inverse: true,
    },
    series: [
      {
        type: "bar",
        data: labeled.map((r) => ({
          value: r.value ?? 0,
          itemStyle: { color: colorForPnl(C, r.value) },
        })),
        barWidth: 14,
        label: {
          show: true,
          position: "right",
          fontSize: 10,
          formatter: (p: { dataIndex: number }) => {
            const r = labeled[p.dataIndex];
            return `${formatMetric(metric, r.value)}  n=${r.n}`;
          },
        },
      },
    ],
  };
  return (
    <InteractiveChart
      option={option}
      height={Math.max(160, rows.length * 36 + 40)}
      showHint={!!onRowClick}
      onChartClick={
        onRowClick
          ? (params) => {
              const i = params.dataIndex ?? 0;
              const row = labeled[i];
              if (row) onRowClick(row);
            }
          : undefined
      }
    />
  );
}

export function sessionName(key: string): string {
  return sessionLabel(key);
}
