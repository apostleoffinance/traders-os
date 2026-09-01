"use client";

export function MarketPulseSkeleton() {
  return (
    <div className="skeleton" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="block" />
      ))}
      <style jsx>{`
        .skeleton {
          display: flex;
          gap: 16px;
          padding: 0 16px;
          align-items: center;
          height: 100%;
        }
        .block {
          display: inline-block;
          width: 120px;
          height: 12px;
          border-radius: 4px;
          background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--border) 60%, transparent) 25%,
            color-mix(in srgb, var(--border) 30%, transparent) 50%,
            color-mix(in srgb, var(--border) 60%, transparent) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.2s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% {
            background-position: 100% 0;
          }
          100% {
            background-position: -100% 0;
          }
        }
      `}</style>
    </div>
  );
}
