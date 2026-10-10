"use client";

import type { ResearchContext } from "@/lib/analytics";

export function ResearchContextNotice({ context }: { context: ResearchContext | null | undefined }) {
  if (!context) return null;

  const activeFilters = Object.entries(context.filters).filter(
    ([key, value]) => value !== null && value !== "" && key !== "preset",
  );
  const population = context.population;

  return (
    <section className="context" aria-label="Research sample and filters">
      <div className="heading">
        <div>
          <strong>Research context</strong>
          <p>{context.sample.reason}</p>
        </div>
        <span className={`evidence ${context.sample.level.toLowerCase()}`}>
          P&amp;L: {context.sample.label} · n={context.sample.n} · R n={context.r_sample.n}
        </span>
      </div>
      <div className="counts">
        <span>{population.filtered_trades} filtered</span>
        <span>{population.closed_trades_with_pnl} with P&amp;L</span>
        <span>{population.closed_trades_missing_r} missing R</span>
        <span>{context.timezone}</span>
      </div>
      {(activeFilters.length > 0 || context.filters.preset) && (
        <div className="filters" aria-label="Applied research filters">
          {context.filters.preset && <span className="chip">Period: {context.filters.preset}</span>}
          {activeFilters.map(([key, value]) => (
            <span className="chip" key={key}>{key.replaceAll("_", " ")}: {value}</span>
          ))}
        </div>
      )}
      {context.limitations.length > 0 && (
        <ul>
          {context.limitations.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
      <style jsx>{`
        .context {
          display: grid;
          gap: 8px;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
          background: var(--surface-2, var(--surface));
        }
        .heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        strong { font-size: 13px; }
        p { margin: 3px 0 0; font-size: 12px; line-height: 1.45; color: var(--text-secondary); }
        .evidence {
          flex: 0 0 auto;
          font-size: 11px;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 3px 8px;
          white-space: nowrap;
        }
        .insufficient { color: var(--text-muted); }
        .low { color: var(--warning, var(--text-secondary)); }
        .moderate { color: var(--accent); }
        .high { color: var(--success); }
        .counts, .filters { display: flex; flex-wrap: wrap; gap: 6px; }
        .counts span, .chip {
          color: var(--text-muted);
          font-size: 11px;
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 3px 7px;
        }
        ul { margin: 0; padding-left: 18px; color: var(--text-secondary); font-size: 12px; line-height: 1.5; }
        @media (max-width: 640px) {
          .heading { flex-direction: column; }
        }
      `}</style>
    </section>
  );
}
