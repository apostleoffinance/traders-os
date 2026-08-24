"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolved, setPreference } = useTheme();
  const isDark = resolved === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className={compact ? "theme-toggle compact" : "theme-toggle"}
      aria-label={label}
      title={label}
      onClick={() => setPreference(isDark ? "light" : "dark")}
    >
      <span className="icon" key={resolved} aria-hidden>
        {isDark ? <Sun size={compact ? 17 : 18} strokeWidth={1.75} /> : <Moon size={compact ? 17 : 18} strokeWidth={1.75} />}
      </span>
      <style jsx>{`
        .theme-toggle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          padding: 0;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: var(--surface);
          color: var(--text-primary);
          cursor: pointer;
          flex-shrink: 0;
          transition:
            border-color 180ms ease,
            background-color 180ms ease,
            color 180ms ease;
        }
        .compact {
          width: 36px;
          height: 36px;
          border-radius: 8px;
        }
        .theme-toggle:hover {
          border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
          background: color-mix(in srgb, var(--accent) 12%, var(--surface));
          color: var(--accent);
        }
        .theme-toggle:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .icon {
          display: inline-flex;
          animation: theme-icon-in 180ms ease;
        }
        @keyframes theme-icon-in {
          from {
            opacity: 0.35;
            transform: rotate(-18deg) scale(0.92);
          }
          to {
            opacity: 1;
            transform: rotate(0deg) scale(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .icon {
            animation: none;
          }
        }
      `}</style>
    </button>
  );
}
