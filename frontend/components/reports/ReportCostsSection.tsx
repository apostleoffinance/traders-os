"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";
import { money } from "@/lib/format";

export function ReportCostsSection({ costs, currency }: { costs: Record<string, unknown>; currency: string }) {
  const gvn = costs.gross_vs_net as { gross_pnl?: string; net_pnl?: string; commission?: string; swap?: string } | undefined;

  return (
    <>
      <h2 className="section-title">Cost & execution impact</h2>
      <ChartCard title="Gross vs net P&L">
        <div className="waterfall">
          <Row label="Gross P&L" value={gvn?.gross_pnl ? money(gvn.gross_pnl, currency) : "—"} />
          <Row label="Commission" value={gvn?.commission ? money(gvn.commission, currency) : "—"} negative />
          <Row label="Swap" value={gvn?.swap ? money(gvn.swap, currency) : "—"} negative />
          <Row label="Net P&L" value={gvn?.net_pnl ? money(gvn.net_pnl, currency) : "—"} strong />
        </div>
      </ChartCard>
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 16px;
        }
        .waterfall {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      `}</style>
    </>
  );
}

function Row({ label, value, negative, strong }: { label: string; value: string; negative?: boolean; strong?: boolean }) {
  return (
    <div className={`row ${strong ? "strong" : ""}`}>
      <span>{label}</span>
      <span className={negative ? "neg" : ""}>{value}</span>
      <style jsx>{`
        .row {
          display: flex;
          justify-content: space-between;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 6px;
        }
        .strong {
          border-color: var(--accent);
        }
        .neg {
          color: var(--neg);
        }
      `}</style>
    </div>
  );
}
