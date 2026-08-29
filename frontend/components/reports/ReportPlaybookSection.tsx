"use client";

import { ChartCard } from "@/components/analytics/primitives/ChartCard";

export function ReportPlaybookSection({ playbooks }: { playbooks: Record<string, unknown> }) {
  const ranked = (playbooks.ranked ?? playbooks.playbooks ?? []) as {
    key?: string;
    label?: string;
    n: number;
    expectancy_r?: string | null;
    edge_quality?: { score: string };
    drift?: string;
  }[];
  const best = playbooks.best_playbook as { label?: string; n?: number; disclaimer?: string } | undefined;

  return (
    <>
      <h2 className="section-title">Playbook intelligence</h2>
      {best?.label ? (
        <ChartCard title="Strongest qualifying playbook" subtitle={best.disclaimer}>
          <p>
            <strong>{best.label}</strong> · n={best.n}
          </p>
        </ChartCard>
      ) : (
        <ChartCard title="Playbook discovery">
          <p className="muted">More observations are required before identifying a reliable playbook (minimum sample applies).</p>
        </ChartCard>
      )}
      {ranked.length > 0 && (
        <ChartCard title="Setup playbooks ranked">
          <table className="tbl">
            <thead>
              <tr>
                <th>Playbook</th>
                <th>n</th>
                <th>Expectancy R</th>
                <th>Quality</th>
              </tr>
            </thead>
            <tbody>
              {ranked.slice(0, 8).map((p) => (
                <tr key={p.key ?? p.label}>
                  <td>{p.label ?? p.key}</td>
                  <td>{p.n}</td>
                  <td>{p.expectancy_r ? `${p.expectancy_r}R` : "—"}</td>
                  <td>{p.edge_quality?.score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>
      )}
      <style jsx>{`
        .section-title {
          font-size: 18px;
          margin: 0 0 16px;
        }
        .muted {
          color: var(--muted);
          font-size: 13px;
        }
        .tbl {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th,
        td {
          text-align: left;
          padding: 8px;
          border-bottom: 1px solid var(--border);
        }
        th {
          font-size: 11px;
          text-transform: uppercase;
          color: var(--muted);
        }
      `}</style>
    </>
  );
}
