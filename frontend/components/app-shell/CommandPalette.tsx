"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getActiveAccountId } from "@/lib/api";
import type { Trade } from "@/lib/types";

type Item = {
  id: string;
  label: string;
  hint?: string;
  href: string;
};

const NAV_ITEMS: Item[] = [
  { id: "cmd", label: "Command Center", href: "/dashboard" },
  { id: "new", label: "New trade", href: "/trades/new" },
  { id: "journal", label: "Trade journal", href: "/trades" },
  { id: "analytics", label: "Analytics Lab", href: "/analytics" },
  { id: "insights", label: "Intelligence", href: "/intelligence" },
  { id: "quant", label: "Quant Lab", href: "/quant-lab" },
  { id: "reports", label: "Performance Reports", href: "/reports" },
  { id: "risk", label: "Risk Command", href: "/risk" },
  { id: "calc", label: "Position calculator", href: "/calculator" },
  { id: "accounts", label: "Accounts", href: "/accounts" },
  { id: "settings", label: "Settings", href: "/settings" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [trades, setTrades] = useState<Trade[]>([]);

  const loadTrades = useCallback(async () => {
    const id = getActiveAccountId();
    if (!id) {
      setTrades([]);
      return;
    }
    try {
      const rows = await api<Trade[]>(`/api/trades?account_id=${id}`);
      setTrades(rows.slice(0, 40));
    } catch {
      setTrades([]);
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) void loadTrades();
  }, [open, loadTrades]);

  const tradeItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return trades
      .filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          (t.setup_name?.toLowerCase().includes(q) ?? false) ||
          t.direction.includes(q),
      )
      .slice(0, 8)
      .map((t) => ({
        id: `trade-${t.id}`,
        label: `${t.symbol} ${t.direction.toUpperCase()}`,
        hint: t.setup_name ?? t.status,
        href: `/trades/${t.id}`,
      }));
  }, [query, trades]);

  const navMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_ITEMS;
    return NAV_ITEMS.filter((i) => i.label.toLowerCase().includes(q));
  }, [query]);

  const items = [...navMatches, ...tradeItems];

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="palette-overlay" role="dialog" aria-modal="true" aria-label="Command palette">
      <button type="button" className="scrim" aria-label="Close" onClick={() => setOpen(false)} />
      <div className="palette">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trades, pages, actions…"
          aria-label="Search"
        />
        <ul>
          {items.length === 0 && <li className="empty">No matches</li>}
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => go(item.href)}>
                <span>{item.label}</span>
                {item.hint && <span className="hint">{item.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
        <p className="foot">⌘K to open · Esc to close</p>
      </div>
      <style jsx>{`
        .palette-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 12vh 16px 16px;
        }
        .scrim {
          position: absolute;
          inset: 0;
          border: 0;
          background: color-mix(in srgb, var(--bg) 30%, transparent);
          backdrop-filter: blur(3px);
          cursor: pointer;
        }
        .palette {
          position: relative;
          width: min(520px, 100%);
          background: var(--surface-elevated);
          border: 1px solid var(--line-strong);
          border-radius: 10px;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
          overflow: hidden;
        }
        input {
          width: 100%;
          box-sizing: border-box;
          border: 0;
          border-bottom: 1px solid var(--line);
          padding: 14px 16px;
          font-size: 16px;
          background: transparent;
          color: var(--text-primary);
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 6px;
          max-height: 360px;
          overflow: auto;
        }
        li button {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          text-align: left;
          border: 0;
          background: transparent;
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          color: var(--text-primary);
          font-size: 15px;
        }
        li button:hover,
        li button:focus-visible {
          background: var(--surface-2);
          outline: none;
        }
        .hint {
          color: var(--muted);
          font-size: 12px;
        }
        .empty {
          padding: 12px;
          color: var(--muted);
        }
        .foot {
          margin: 0;
          padding: 8px 14px;
          font-size: 11px;
          color: var(--muted);
          border-top: 1px solid var(--line);
        }
      `}</style>
    </div>
  );
}
