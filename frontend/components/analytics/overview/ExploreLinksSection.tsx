"use client";

import Link from "next/link";

type TabId = "overview" | "performance" | "edge" | "behaviour" | "execution" | "risk" | "calendar";

const LINKS: { tab: TabId; label: string; description: string }[] = [
  { tab: "performance", label: "Performance", description: "Deeper KPIs, distributions, and period comparisons" },
  { tab: "edge", label: "Edge Explorer", description: "Instrument × session matrix and advanced edge tools" },
  { tab: "execution", label: "Execution", description: "MFE/MAE, exit efficiency, and position sizing" },
  { tab: "risk", label: "Risk", description: "Drawdown research and capital preservation" },
  { tab: "calendar", label: "Calendar", description: "Day-by-day and temporal patterns" },
];

export function ExploreLinksSection({
  onTabChange,
}: {
  onTabChange?: (tab: TabId) => void;
}) {
  return (
    <section className="section">
      <h2 className="section-title">Go deeper</h2>
      <p className="section-lead">Advanced analytics live in dedicated sections when you want to investigate further.</p>
      <div className="links">
        {LINKS.map((link) =>
          onTabChange ? (
            <button key={link.tab} type="button" className="card" onClick={() => onTabChange(link.tab)}>
              <strong>{link.label}</strong>
              <span>{link.description}</span>
            </button>
          ) : (
            <Link key={link.tab} href={`/analytics?tab=${link.tab}`} className="card">
              <strong>{link.label}</strong>
              <span>{link.description}</span>
            </Link>
          ),
        )}
        <Link href="/quant-lab" className="card quant">
          <strong>Quant Lab</strong>
          <span>Statistical research — distributions, Monte Carlo, bootstrap</span>
        </Link>
      </div>
      <style jsx>{`
        .section {
          margin-top: 8px;
        }
        .section-title {
          margin: 0 0 4px;
          font-size: 18px;
        }
        .section-lead {
          margin: 0 0 14px;
          font-size: 14px;
          color: var(--text-muted);
        }
        .links {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 10px;
        }
        .card {
          display: block;
          text-align: left;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px 16px;
          background: var(--surface);
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          transition: border-color 0.15s;
        }
        .card:hover {
          border-color: var(--accent);
        }
        .card strong {
          display: block;
          font-size: 14px;
          margin-bottom: 4px;
        }
        .card span {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .quant {
          border-style: dashed;
        }
      `}</style>
    </section>
  );
}
