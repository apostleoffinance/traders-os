"use client";

export function ScatterQuadrantGuide({
  xLabel,
  yLabel,
  quadrants,
}: {
  xLabel: string;
  yLabel: string;
  quadrants: { position: string; meaning: string }[];
}) {
  return (
    <div className="guide" role="note">
      <p className="head">
        Reading this chart: each point is one trade. <strong>{xLabel}</strong> on the horizontal axis,{" "}
        <strong>{yLabel}</strong> on the vertical.
      </p>
      <ul>
        {quadrants.map((q) => (
          <li key={q.position}>
            <span className="pos">{q.position}</span>
            {q.meaning}
          </li>
        ))}
      </ul>
      <style jsx>{`
        .guide {
          margin: 0 0 12px;
          padding: 12px 14px;
          border-radius: 8px;
          background: color-mix(in srgb, var(--surface-2, var(--surface)) 55%, transparent);
          border: 1px solid var(--border);
        }
        .head {
          margin: 0 0 8px;
          font-size: 13px;
          line-height: 1.45;
          color: var(--text-secondary);
        }
        ul {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 4px;
        }
        li {
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .pos {
          display: inline-block;
          min-width: 88px;
          font-weight: 600;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
