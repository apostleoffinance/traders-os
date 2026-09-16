"use client";

import { ChartCard } from "@/components/trader/ChartCard";
import { MetricCard } from "@/components/trader/MetricCard";
import type { AnalyticsDashboard } from "@/lib/analytics";
import { money, num } from "@/lib/format";

/** Calendar metrics — best/worst day before the grid. */
export function CalendarAnswerStrip({ data }: { data: AnalyticsDashboard }) {
  const t = data.lab?.temporal;
  const currency = data.account.currency;
  if (!t) return null;

  const days = t.calendar.days.filter((d) => d.n > 0);
  const byR = [...days].sort((a, b) => Number(b.r ?? -999) - Number(a.r ?? -999));
  const bestDay = byR[0];
  const worstDay = byR[byR.length - 1];
  const weekday = [...t.weekday]
    .filter((w) => w.n > 0)
    .sort((a, b) => Number(b.net_pnl ?? -999) - Number(a.net_pnl ?? -999));
  const bestWd = weekday[0];

  return (
    <ChartCard title="Calendar">
      <div className="grid">
        <MetricCard
          label="Best day"
          value={bestDay ? bestDay.date.slice(5, 10) : "—"}
          hint={
            bestDay
              ? bestDay.r != null
                ? `${num(bestDay.r)}R · n=${bestDay.n}`
                : money(bestDay.net_pnl, currency)
              : undefined
          }
          tone="pos"
        />
        <MetricCard
          label="Worst day"
          value={worstDay && worstDay.date !== bestDay?.date ? worstDay.date.slice(5, 10) : "—"}
          hint={
            worstDay && worstDay.date !== bestDay?.date
              ? worstDay.r != null
                ? `${num(worstDay.r)}R · n=${worstDay.n}`
                : money(worstDay.net_pnl, currency)
              : undefined
          }
          tone="neg"
        />
        <MetricCard
          label="Best weekday"
          value={bestWd?.key ?? "—"}
          hint={bestWd ? `${money(bestWd.net_pnl, currency)} · n=${bestWd.n}` : undefined}
        />
        <MetricCard label="Trading days" value={String(days.length)} />
      </div>
      <style jsx>{`
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 12px;
        }
      `}</style>
    </ChartCard>
  );
}
