"use client";

import { useMemo, useState } from "react";
import type { AutoCheck, ChecklistItem, ChecklistTemplate } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  market_context: "Market context",
  setup_confirmation: "Setup confirmation",
  risk: "Risk management",
  psychology: "Psychology",
  execution: "Execution",
};

const CATEGORY_ORDER = ["market_context", "setup_confirmation", "risk", "psychology", "execution"];

export function processCheckStatus(
  previewStatus: string | undefined,
  policy: { allowed: boolean; requires_confirmation: boolean } | null | undefined,
  items: ChecklistItem[],
  checked: Record<string, boolean>,
): "valid" | "incomplete" | "warning" | "blocked" {
  const hardBlock =
    previewStatus === "blocked" || (policy != null && !policy.allowed && !policy.requires_confirmation);
  if (hardBlock) return "blocked";
  const requiredManual = items.filter((i) => i.kind !== "automatic" && i.required);
  if (requiredManual.some((i) => !checked[i.id])) return "incomplete";
  if (previewStatus === "warning" || (policy != null && policy.requires_confirmation)) return "warning";
  return "valid";
}

export function PreTradeCheck({
  template,
  checked,
  onToggle,
  autoChecks,
  status,
}: {
  template: ChecklistTemplate | null;
  checked: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
  autoChecks: AutoCheck[];
  status: "valid" | "incomplete" | "warning" | "blocked";
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    market_context: true,
    setup_confirmation: true,
    risk: true,
    psychology: true,
    execution: true,
  });
  const autoByKey = useMemo(() => {
    const map: Record<string, AutoCheck> = {};
    for (const check of autoChecks) map[check.auto_key] = check;
    return map;
  }, [autoChecks]);

  const groups = useMemo(() => {
    const items = template?.items ?? [];
    return CATEGORY_ORDER.map((key) => ({
      key,
      label: CATEGORY_LABELS[key] ?? key,
      items: items.filter((item) => item.category === key),
    })).filter((g) => g.items.length > 0);
  }, [template]);

  function groupProgress(items: ChecklistItem[]): { done: number; total: number } {
    let done = 0;
    for (const item of items) {
      if (item.kind === "automatic" && item.auto_key) {
        if (autoByKey[item.auto_key]?.passed) done += 1;
      } else if (checked[item.id]) {
        done += 1;
      }
    }
    return { done, total: items.length };
  }

  const statusLabel =
    status === "blocked" ? "BLOCKED" : status === "incomplete" ? "INCOMPLETE" : status === "warning" ? "WARNING" : "VALID";

  return (
    <div className="pretrade">
      <div className={`banner ${status}`}>
        <strong>Pre-trade check · {statusLabel}</strong>
        <p>
          Checklist confirmation records that you reviewed your trading conditions. It does not indicate that the
          setup is profitable or that the trade will win.
        </p>
      </div>
      {groups.map((group) => {
        const progress = groupProgress(group.items);
        const complete = progress.total > 0 && progress.done === progress.total;
        const expanded = open[group.key] !== false;
        return (
          <section key={group.key} className="cat">
            <button
              type="button"
              className="cat-h"
              onClick={() => setOpen((o) => ({ ...o, [group.key]: !expanded }))}
              aria-expanded={expanded}
            >
              <span>{group.label}</span>
              <span className={complete ? "ok count" : "muted count"}>
                {progress.done} / {progress.total}
                {complete ? " complete" : ""}
              </span>
            </button>
            {expanded && (
              <ul>
                {group.items.map((item) => {
                  if (item.kind === "automatic" && item.auto_key) {
                    const auto = autoByKey[item.auto_key];
                    const st = auto?.status ?? "warning";
                    return (
                      <li key={item.id} className={`auto ${st}`}>
                        <span className={`mark ${st === "blocked" ? "neg" : auto?.passed ? "ok" : "warn"}`} aria-hidden>
                          {auto?.passed ? "✓" : st === "blocked" ? "×" : "○"}
                        </span>
                        <span>{auto?.display ?? item.label}</span>
                      </li>
                    );
                  }
                  return (
                    <li key={item.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(checked[item.id])}
                          onChange={(e) => onToggle(item.id, e.target.checked)}
                        />
                        {item.label}
                        {item.required ? <span className="req">required</span> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      <style jsx>{`
        .pretrade {
          display: grid;
          gap: 0;
          border: 1px solid var(--border);
          background: var(--bg);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        .banner {
          padding: 16px 18px;
          border-bottom: 1px solid var(--line);
        }
        .banner strong {
          display: block;
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--text-primary);
        }
        .banner p {
          margin: 8px 0 0;
          color: var(--text-primary);
          font-size: 15px;
          font-weight: 500;
          line-height: 1.5;
        }
        .banner.valid {
          background: var(--green-bg);
        }
        .banner.warning,
        .banner.incomplete {
          background: var(--amber-bg);
          box-shadow: inset 4px 0 0 var(--accent);
        }
        .banner.blocked {
          background: var(--red-bg);
        }
        .cat-h {
          width: 100%;
          display: flex;
          justify-content: space-between;
          border: none;
          border-bottom: 1px solid var(--line);
          background: var(--surface);
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--text-primary);
          cursor: pointer;
          position: relative;
          z-index: 1;
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        li {
          padding: 12px 16px;
          border-bottom: 1px solid var(--line);
          font-size: 15px;
          font-weight: 500;
        }
        .auto {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .count {
          font-family: var(--font-mono), "IBM Plex Mono", ui-monospace, Menlo, monospace;
          font-size: 14px;
          font-weight: 600;
        }
        .mark {
          width: 18px;
          text-align: center;
          font-size: 16px;
          font-family: var(--font-mono), "IBM Plex Mono", ui-monospace, Menlo, monospace;
        }
        label {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .req {
          margin-left: auto;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
}
