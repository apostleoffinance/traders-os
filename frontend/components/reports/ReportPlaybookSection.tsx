"use client";

import { ChartCard } from "@/components/trader";
import { ReportTable } from "@/components/trader/tables/ResearchTable";
import { useMemo } from "react";
import { formatSampleSize } from "@/lib/visualization";

type PlaybookRow = {
  key?: string;
  label?: string;
  n: number;
  expectancy_r?: string | null;
  edge_quality?: { score: string };
  drift?: string;
};

export function ReportPlaybookSection({ playbooks }: { playbooks: Record<string, unknown> }) {
  const ranked = (playbooks.ranked ?? playbooks.playbooks ?? []) as PlaybookRow[];
  const best = playbooks.best_playbook as { label?: string; n?: number; disclaimer?: string } | undefined;
  const top = useMemo(() => ranked.slice(0, 8), [ranked]);

  const columns = useMemo(
    () => [
      { id: "label", header: "Playbook", accessor: (p: PlaybookRow) => p.label ?? p.key ?? "—" },
      { id: "n", header: "n", accessor: (p: PlaybookRow) => p.n, numeric: true },
      {
        id: "exp",
        header: "Expectancy R",
        accessor: (p: PlaybookRow) => (p.expectancy_r ? `${p.expectancy_r}R` : "—"),
        numeric: true,
      },
      {
        id: "quality",
        header: "Quality",
        accessor: (p: PlaybookRow) => p.edge_quality?.score ?? "—",
      },
    ],
    [],
  );

  return (
    <>
      <h2 className="section-title">Playbook intelligence</h2>
      {best?.label ? (
        <ChartCard title="Strongest qualifying playbook" subtitle={best.disclaimer}>
          <p>
            <strong>{best.label}</strong> · {formatSampleSize(best.n ?? 0)}
          </p>
        </ChartCard>
      ) : (
        <ChartCard title="Playbook discovery">
          <p className="muted">More observations are required before identifying a reliable playbook (minimum sample applies).</p>
        </ChartCard>
      )}
      {top.length > 0 && (
        <ChartCard title="Setup playbooks ranked">
          <ReportTable
            rows={top}
            columns={columns}
            getRowId={(p, i) => p.key ?? p.label ?? String(i)}
            caption="Ranked playbooks"
          />
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
      `}</style>
    </>
  );
}
