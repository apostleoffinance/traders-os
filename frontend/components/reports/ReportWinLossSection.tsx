"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { money, num } from "@/lib/format";

export function ReportWinLossSection({
  performance,
  currency,
}: {
  performance: Record<string, unknown>;
  currency: string;
}) {
  const wl = (performance.win_loss ?? {}) as Record<string, string | number | null>;
  const streaks = (performance.streaks ?? {}) as {
    longest?: { wins?: number; losses?: number };
    current?: { wins?: number; losses?: number };
  };
  const hist = (performance.streak_timeline ?? {}) as {
    win_distribution?: { length: number; occurrences: number }[];
    loss_distribution?: { length: number; occurrences: number }[];
  };

  return (
    <>
      <h2 className="section-title">Win / loss intelligence</h2>
      <div className="kpis">
        <Kpi label="Winners" value={String(wl.wins ?? "—")} />
        <Kpi label="Losers" value={String(wl.losses ?? "—")} />
        <Kpi label="Win rate" value={wl.win_rate ? `${wl.win_rate}%` : "—"} />
        <Kpi label="Avg win" value={wl.average_win ? money(String(wl.average_win), currency) : "—"} />
        <Kpi label="Avg loss" value={wl.average_loss ? money(String(wl.average_loss), currency) : "—"} />
        <Kpi label="Win/loss ratio" value={wl.win_loss_ratio ? num(String(wl.win_loss_ratio), 2) : "—"} />
        <Kpi label="Longest win streak" value={streaks.longest?.wins != null ? String(streaks.longest.wins) : "—"} />
        <Kpi label="Longest loss streak" value={streaks.longest?.losses != null ? String(streaks.longest.losses) : "—"} />
      </div>
      {(hist.win_distribution?.length || hist.loss_distribution?.length) ? (
        <ChartCard title="Streak length distribution" subtitle="How often streaks of each length occurred">
          <div className="dist">
            {hist.win_distribution?.map((d) => (
              <span key={`w-${d.length}`} className="chip win" title={`${d.length}-trade win streaks: ${d.occurrences}x`}>
                W×{d.length} ({d.occurrences})
              </span>
            ))}
            {hist.loss_distribution?.map((d) => (
              <span key={`l-${d.length}`} className="chip loss" title={`${d.length}-trade loss streaks: ${d.occurrences}x`}>
                L×{d.length} ({d.occurrences})
              </span>
            ))}
          </div>
        </ChartCard>
      ) : null}
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 16px;
        }
        .kpis {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }
        .dist {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .chip {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
        }
        .chip.win {
          background: color-mix(in srgb, var(--pos) 25%, transparent);
          color: var(--pos);
        }
        .chip.loss {
          background: color-mix(in srgb, var(--neg) 25%, transparent);
          color: var(--neg);
        }
        .chip.breakeven {
          background: var(--surface-2);
          color: var(--muted);
        }
      `}</style>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi">
      <span>{label}</span>
      <strong>{value}</strong>
      <style jsx>{`
        .kpi {
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 10px;
        }
        span {
          font-size: 10px;
          text-transform: uppercase;
          color: var(--muted);
        }
        strong {
          display: block;
          margin-top: 4px;
          font-family: var(--font-mono), monospace;
          font-size: 15px;
        }
      `}</style>
    </div>
  );
}
