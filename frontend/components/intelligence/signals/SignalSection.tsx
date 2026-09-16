"use client";

import type { Finding } from "@/lib/intelligence";
import { buildSignalList } from "@/lib/intelligence/signal-ui";
import { SignalCard } from "./SignalCard";

export function SignalSection({
  primary,
  attention,
  selectedId,
  onSelect,
}: {
  primary: Finding | null;
  attention: Finding[];
  selectedId?: string | null;
  onSelect?: (finding: Finding) => void;
}) {
  const signals = buildSignalList(primary, attention);
  if (!signals.length) return null;

  const [featured, ...rest] = signals;

  return (
    <section className="signals" aria-labelledby="signals-title">
      <header className="section-head">
        <h2 id="signals-title">TraderOS signals</h2>
        <p className="sub">What stands out in your trading?</p>
      </header>

      {featured ? (
        <SignalCard
          finding={featured}
          featured
          selected={selectedId === featured.id}
          onSelect={onSelect}
        />
      ) : null}

      {rest.length > 0 ? (
        <div className="grid" role="list">
          {rest.map((finding) => (
            <div key={finding.id} role="listitem">
              <SignalCard
                finding={finding}
                selected={selectedId === finding.id}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      ) : null}

      <style jsx>{`
        .signals {
          display: grid;
          gap: 12px;
        }
        .section-head {
          display: grid;
          gap: 2px;
        }
        h2 {
          margin: 0;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-primary);
        }
        .sub {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 700px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

export function SignalSectionSkeleton() {
  return (
    <div className="skel" aria-hidden>
      <div className="label" />
      <div className="hero" />
      <div className="grid">
        <div className="card" />
        <div className="card" />
        <div className="card" />
      </div>
      <style jsx>{`
        .skel {
          display: grid;
          gap: 12px;
        }
        .label {
          width: 160px;
          height: 12px;
          border-radius: 4px;
          background: var(--surface-2);
        }
        .hero {
          height: 180px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface);
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .card {
          height: 140px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--surface);
        }
        @media (max-width: 700px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
