"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, clearSession, ensureFreshAccessToken, getActiveAccountId, hasSession, isAuthFailure, setActiveAccountId } from "@/lib/api";
import { PERIOD_LABELS, useGlobalFilters, type PeriodPreset } from "@/lib/filters";
import { fetchMt5Connection } from "@/lib/mt5";
import type { Account, User } from "@/lib/types";
import { BrandMark } from "@/components/BrandMark";
import { CommandPalette } from "@/components/app-shell/CommandPalette";
import { SessionClock } from "@/components/app-shell/SessionClock";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatWhen } from "@/lib/format";

const SIDEBAR_KEY = "trader-os-sidebar-collapsed";

type NavItem = {
  href: string;
  label: string;
  index: string;
  match?: "exact" | "prefix";
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Workspace", index: "01", match: "exact" },
  { href: "/labs/vela", label: "Markets", index: "02", match: "prefix" },
  { href: "/risk", label: "Portfolio & Risk", index: "03", match: "exact" },
  { href: "/trades", label: "Journal", index: "04", match: "prefix" },
  { href: "/analytics", label: "Analytics", index: "05", match: "prefix" },
  { href: "/quant-lab", label: "Research Lab", index: "06", match: "prefix" },
  { href: "/risk/limits", label: "Risk Limits", index: "07", match: "prefix" },
  { href: "/intelligence", label: "Intelligence", index: "08", match: "prefix" },
  { href: "/settings", label: "Operations", index: "09", match: "prefix" },
];

function navActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/trades") {
    return pathname === "/trades" || pathname.startsWith("/trades/");
  }
  if (item.match === "exact") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === "true";
  } catch {
    return false;
  }
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { filters, setFilters } = useGlobalFilters();
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  useEffect(() => {
    setCollapsed(readCollapsed());
    setReady(true);
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 900) setNavOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!hasSession()) {
      router.replace("/login");
      return;
    }
    void (async () => {
      setBootError(null);
      try {
        const sessionOk = await ensureFreshAccessToken();
        if (!sessionOk) {
          router.replace("/login");
          return;
        }
        const me = await api<User>("/api/auth/me");
        setUser(me);
        const list = await api<Account[]>("/api/accounts");
        setAccounts(list);
        const stored = getActiveAccountId();
        const next = list.find((a) => a.id === stored)?.id ?? list[0]?.id ?? null;
        if (next) {
          setActiveAccountId(next);
          setAccountId(next);
        }
      } catch (err) {
        if (isAuthFailure(err)) {
          clearSession();
          router.replace("/login");
          return;
        }
        setBootError(err instanceof Error ? err.message : "Unable to load workspace.");
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!accountId) {
      setLastSyncAt(null);
      return;
    }
    let cancelled = false;
    void fetchMt5Connection(accountId)
      .then((connection) => {
        if (!cancelled) setLastSyncAt(connection?.last_sync_at ?? null);
      })
      .catch(() => {
        if (!cancelled) setLastSyncAt(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  function onAccount(id: string) {
    setActiveAccountId(id);
    setAccountId(id);
    window.dispatchEvent(new Event("traderos-account"));
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {
        /* ignore quota / private mode */
      }
      return next;
    });
  }

  const active = useMemo(() => accounts.find((a) => a.id === accountId) ?? null, [accounts, accountId]);

  function renderNav(opts: { collapsedMode: boolean; showToggle?: boolean; onNavigate?: () => void }) {
    const { collapsedMode, showToggle = false, onNavigate } = opts;
    const toggleLabel = collapsedMode ? "Expand sidebar" : "Collapse sidebar";
    return (
      <>
        <div className={collapsedMode ? "brand-block brand-block-collapsed" : "brand-block"}>
          <div className="brand-row">
            <Link
              href="/dashboard"
              className={collapsedMode ? "brand brand-collapsed" : "brand"}
              onClick={onNavigate}
              title={collapsedMode ? "TraderOS" : undefined}
              aria-label="TraderOS"
            >
              <BrandMark size={collapsedMode ? 28 : 26} />
              {!collapsedMode && (
                <span className="brand-name">
                  TraderOS
                  <span className="brand-sub">Workstation</span>
                </span>
              )}
            </Link>
            {showToggle && (
              <button
                type="button"
                className="sidebar-toggle"
                onClick={toggleCollapsed}
                aria-label={toggleLabel}
                title={toggleLabel}
              >
                {collapsedMode ? (
                  <ChevronRight size={16} strokeWidth={2} aria-hidden />
                ) : (
                  <ChevronLeft size={16} strokeWidth={2} aria-hidden />
                )}
              </button>
            )}
          </div>
        </div>
        <nav aria-label="Main">
          {NAV.map((item) => {
            const isActive = navActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link${isActive ? " active" : ""}`}
                onClick={onNavigate}
                title={collapsedMode ? item.label : undefined}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <i className="nav-index">{collapsedMode ? item.index.slice(1) : item.index}</i>
                {!collapsedMode && <span className="nav-label">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </>
    );
  }

  return (
    <div className={`shell-wrap${ready && collapsed ? " is-collapsed" : ""}${ready ? " is-ready" : ""}`}>
      <div className="shell">
        <aside className="rail desktop">{renderNav({ collapsedMode: collapsed, showToggle: true })}</aside>
        <div className="main">
          <header className="top">
            <div className="top-left">
              <button type="button" className="menu" aria-label="Open menu" onClick={() => setNavOpen(true)}>
                Menu
              </button>
              <SessionClock />
            </div>
            <div className="top-right">
              <button type="button" className="cmd-btn" onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}>
                ⌘K
              </button>
              <select
                className="period-select"
                aria-label="Period"
                value={filters.period}
                onChange={(e) => setFilters({ period: e.target.value as PeriodPreset })}
              >
                {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => (
                  <option key={p} value={p}>
                    {PERIOD_LABELS[p]}
                  </option>
                ))}
              </select>
              <ThemeToggle compact />
              <select
                id="acct"
                aria-label="Account"
                value={accountId ?? ""}
                onChange={(e) => onAccount(e.target.value)}
                disabled={accounts.length === 0}
              >
                {accounts.length === 0 && <option value="">No account</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_name}
                  </option>
                ))}
              </select>
              <div className="who">
                <span className="who-name">{user?.display_name || user?.email || "Signed in"}</span>
                <button type="button" className="who-out" onClick={logout}>
                  Sign out
                </button>
              </div>
            </div>
          </header>
          <div className="page">
            {bootError && <p className="boot-error">{bootError}</p>}
            {children}
          </div>
          <footer className="status-foot">
            <span>Account scope: {active ? active.account_name : "none"}</span>
            <span>Timestamps: UTC</span>
            <span>
              Last sync: {lastSyncAt ? formatWhen(lastSyncAt, "UTC") : "no MT5 sync yet"}
            </span>
          </footer>
        </div>
      </div>
      {navOpen && (
        <div className="overlay" role="dialog" aria-label="Navigation">
          <button type="button" className="scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />
          <aside className="rail drawer">{renderNav({ collapsedMode: false, onNavigate: () => setNavOpen(false) })}</aside>
        </div>
      )}
      <CommandPalette />
      <style jsx>{`
        .shell-wrap {
          min-height: 100vh;
          font-size: 17px;
          font-weight: 500;
          line-height: 1.55;
          --rail-width: 260px;
          --rail-width-collapsed: 68px;
        }
        .shell-wrap.is-collapsed {
          --rail-width: var(--rail-width-collapsed);
        }
        .shell {
          display: grid;
          grid-template-columns: var(--rail-width) minmax(0, 1fr);
          min-height: 100vh;
        }
        .shell-wrap.is-ready .shell {
          transition: grid-template-columns 200ms ease;
        }
        .rail {
          background: var(--rail-bg);
          color: var(--rail-text);
          display: flex;
          flex-direction: column;
          padding: 20px 12px 14px;
          position: sticky;
          top: 0;
          height: 100vh;
          max-height: 100vh;
          overflow: auto;
          z-index: 2;
          box-sizing: border-box;
        }
        .shell-wrap.is-collapsed .desktop {
          padding-left: 10px;
          padding-right: 10px;
          align-items: center;
        }
        :global(.brand-block) {
          display: flex;
          flex-direction: column;
          margin-bottom: 20px;
          width: 100%;
        }
        :global(.brand-block-collapsed) {
          align-items: center;
        }
        :global(.brand-row) {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
          min-width: 0;
        }
        :global(.brand-block-collapsed) :global(.brand-row) {
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        :global(a.brand) {
          display: flex;
          gap: 10px;
          align-items: center;
          padding: 2px 6px;
          color: inherit;
          text-decoration: none;
          min-height: 36px;
          min-width: 0;
          flex: 1;
        }
        :global(a.brand:hover) {
          color: inherit;
        }
        .shell-wrap.is-collapsed :global(a.brand-collapsed) {
          justify-content: center;
          padding: 2px 0;
          width: 100%;
          flex: none;
        }
        :global(.brand-name) {
          display: flex;
          flex-direction: column;
          font-weight: 600;
          letter-spacing: 0.08em;
          font-size: 13px;
          text-transform: uppercase;
          white-space: nowrap;
          line-height: 1.15;
        }
        :global(.brand-sub) {
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          color: var(--rail-muted);
        }
        nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          width: 100%;
        }
        .nav-kicker {
          margin: 0 0 6px;
          padding: 0 12px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--rail-muted, var(--muted));
        }
        .account-kicker {
          margin-top: 18px;
        }
        .nav-group {
          margin-top: 8px;
        }
        .nav-divider {
          height: 1px;
          width: 60%;
          margin: 12px auto;
          background: var(--rail-border, var(--border));
          opacity: 0.7;
        }
        :global(a.nav-link) {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          box-sizing: border-box;
          padding: 11px 12px;
          color: var(--rail-text);
          border-left: 2px solid transparent;
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
          font-size: 15px;
          font-weight: 500;
          line-height: 1.3;
          cursor: pointer;
          position: relative;
          z-index: 1;
          text-decoration: none;
        }
        .shell-wrap.is-collapsed .desktop :global(a.nav-link) {
          justify-content: center;
          padding: 12px 0;
          border-left-width: 0;
          border-radius: var(--radius-sm);
        }
        :global(a.nav-link:hover) {
          background: var(--rail-hover);
          color: var(--rail-text);
        }
        :global(a.nav-link.secondary) {
          font-size: 13px;
          font-weight: 500;
          color: var(--rail-muted, var(--muted));
          padding-top: 6px;
          padding-bottom: 6px;
        }
        :global(a.nav-link.active) {
          color: var(--rail-text);
          background: var(--rail-active);
          border-left-color: var(--accent);
        }
        .shell-wrap.is-collapsed .desktop :global(a.nav-link.active) {
          border-left-color: transparent;
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
        }
        :global(a.nav-link:focus-visible) {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        :global(.nav-label) {
          white-space: nowrap;
        }
        :global(.nav-index) {
          font-style: normal;
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10px;
          color: var(--rail-muted);
          width: 18px;
          flex-shrink: 0;
        }
        :global(a.nav-link.active .nav-index) {
          color: var(--accent);
        }
        .main {
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: var(--bg);
        }
        .top {
          min-height: 48px;
          border-bottom: 1px solid var(--border);
          background: var(--chrome, var(--surface));
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          padding: 8px 16px;
          gap: 8px 12px;
        }
        .status-foot {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 18px;
          padding: 8px 16px;
          border-top: 1px solid var(--border);
          background: var(--chrome, var(--surface));
          font-family: var(--font-mono), ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: 0.04em;
          color: var(--text-muted);
        }
        .top-left,
        .top-right {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .top-left {
          flex: 1 1 220px;
        }
        .top-right {
          flex: 1 1 280px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .menu {
          display: none;
          border: 1px solid var(--border);
          background: transparent;
          padding: 5px 10px;
          font-size: 12px;
          border-radius: var(--radius-sm);
        }
        .crumb {
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .eq-chip {
          display: flex;
          align-items: baseline;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
        }
        select {
          background: var(--surface);
          border: 1px solid var(--border);
          padding: 8px 10px;
          min-width: 0;
          max-width: 200px;
          color: var(--text-primary);
          border-radius: var(--radius-sm);
          font-size: 15px;
          font-weight: 500;
        }
        .period-select {
          min-width: 120px;
          max-width: 140px;
        }
        .cmd-btn {
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--muted);
          font-size: 12px;
          font-family: var(--font-mono), monospace;
          padding: 7px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
        }
        .cmd-btn:hover {
          color: var(--text-primary);
          border-color: var(--line-strong);
        }
        .who {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .who-name {
          display: none;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (min-width: 1280px) {
          .who-name {
            display: inline;
          }
        }
        .who-out {
          border: 1px solid var(--line-strong);
          background: var(--surface);
          color: var(--text-primary);
          font-size: 15px;
          font-weight: 600;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          cursor: pointer;
        }
        .who-out:hover {
          border-color: var(--text-secondary);
        }
        .boot-error {
          margin: 0 0 16px;
          padding: 10px 12px;
          border: 1px solid var(--warn, #b8860b);
          border-radius: var(--radius-sm);
          background: color-mix(in srgb, var(--warn, #b8860b) 12%, transparent);
          color: var(--text-primary);
          font-size: 14px;
        }
        .page {
          flex: 1;
          padding: 20px 24px 48px;
          position: relative;
          z-index: 0;
          color: var(--text-primary);
        }
        .page :global(h1) {
          font-size: 22px;
          font-weight: 600;
          letter-spacing: -0.02em;
        }
        .page :global(.page-kicker) {
          font-size: 13px;
          font-weight: 600;
        }
        .page :global(.blotter) {
          font-size: 15px;
        }
        .page :global(.blotter th) {
          font-size: 12px;
          font-weight: 700;
        }
        .page :global(.btn) {
          font-size: 15px;
          font-weight: 600;
          padding: 10px 16px;
        }
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 40;
        }
        .scrim {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(0, 0, 0, 0.45);
          cursor: pointer;
        }
        @media (max-width: 1024px) {
          .eq-chip {
            display: none;
          }
        }
        @media (max-width: 900px) {
          .shell {
            grid-template-columns: minmax(0, 1fr);
          }
          .shell-wrap.is-ready .shell {
            transition: none;
          }
          .desktop {
            display: none;
          }
          .menu {
            display: inline-flex;
            cursor: pointer;
          }
          .drawer {
            position: relative;
            z-index: 1;
            width: min(280px, 86vw);
            min-height: 100vh;
            max-height: 100vh;
            padding: 24px 16px 18px;
          }
          select {
            min-width: 140px;
          }
        }
      `}</style>
    </div>
  );
}
