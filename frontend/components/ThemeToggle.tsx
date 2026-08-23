"use client";

import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolved, setPreference } = useTheme();

  return (
    <div className={compact ? "theme-switch compact" : "theme-switch"} role="group" aria-label="Theme">
      <button
        type="button"
        className={resolved === "light" ? "on" : ""}
        aria-pressed={resolved === "light"}
        onClick={() => setPreference("light")}
      >
        Light
      </button>
      <button
        type="button"
        className={resolved === "dark" ? "on" : ""}
        aria-pressed={resolved === "dark"}
        onClick={() => setPreference("dark")}
      >
        Dark
      </button>
      <style jsx>{`
        .theme-switch {
          display: inline-grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid var(--line-strong);
          background: var(--surface);
          padding: 3px;
          gap: 3px;
          border-radius: 999px;
          min-width: 132px;
        }
        .compact {
          min-width: 112px;
          padding: 2px;
        }
        button {
          border: 0;
          background: transparent;
          padding: 6px 12px;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-secondary);
          border-radius: 999px;
          cursor: pointer;
        }
        .compact button {
          padding: 4px 8px;
          font-size: 10px;
        }
        .on {
          background: var(--accent);
          color: var(--accent-contrast);
        }
      `}</style>
    </div>
  );
}
