"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  BrainCircuit,
  Calculator,
  ChartNoAxesCombined,
  FileText,
  FlaskConical,
  CandlestickChart,
  History,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Settings,
  ShieldAlert,
  WalletCards,
  type LucideProps,
} from "lucide-react";
import { api, clearSession, ensureFreshAccessToken, getActiveAccountId, hasSession, isAuthFailure, setActiveAccountId } from "@/lib/api";
import { PERIOD_LABELS, useGlobalFilters, type PeriodPreset } from "@/lib/filters";
import type { Account, User } from "@/lib/types";
import { BrandMark } from "@/components/BrandMark";
import { CommandPalette } from "@/components/app-shell/CommandPalette";
import { MarketPulse } from "@/components/market/MarketPulse";
import { ThemeToggle } from "@/components/ThemeToggle";
import { money, signed, tone } from "@/lib/format";

const SIDEBAR_KEY = "trader-os-sidebar-collapsed";

type NavIcon = ComponentType<LucideProps>;

type NavGroup = "command" | "trading" | "intelligence" | "risk" | "account";

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  group: NavGroup;
};

const GROUP_LABELS: Record<NavGroup, string> = {
  command: "Command",
  trading: "Trading",
  intelligence: "Insights",
  risk: "Risk",
  account: "Account",
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Command Center", icon: LayoutDashboard, group: "command" },
  { href: "/trades/new", label: "New trade", icon: PlusCircle, group: "trading" },
  { href: "/trades", label: "Trade journal", icon: History, group: "trading" },
  { href: "/calculator", label: "Calculator", icon: Calculator, group: "trading" },
  { href: "/analytics", label: "Analytics Lab", icon: ChartNoAxesCombined, group: "intelligence" },
  { href: "/intelligence", label: "Intelligence Feed", icon: BrainCircuit, group: "intelligence" },
  { href: "/quant-lab", label: "Quant Lab", icon: FlaskConical, group: "intelligence" },
  { href: "/labs/vela", label: "Vela Lab", icon: CandlestickChart, group: "intelligence" },
  { href: "/reports", label: "Reports", icon: FileText, group: "intelligence" },
  { href: "/risk", label: "Risk Command", icon: ShieldAlert, group: "risk" },
  { href: "/accounts", label: "Accounts", icon: WalletCards, group: "account" },
  { href: "/settings", label: "Settings", icon: Settings, group: "account" },
];

function navActive(href: string, pathname: string): boolean {
  if (href === "/trades") {
    return pathname === "/trades" || (pathname.startsWith("/trades/") && !pathname.startsWith("/trades/new"));
  }
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/accounts") return pathname === "/accounts" || pathname.startsWith("/accounts/");
  return pathname === href || pathname.startsWith(`${href}/`);
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
  const pnl = active ? Number(active.current_equity) - Number(active.starting_balance) : 0;

  const navGroups: NavGroup[] = ["command", "trading", "intelligence", "risk", "account"];

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
              title={collapsedMode ? "Trader OS" : undefined}
              aria-label="Trader OS"
            >
              <BrandMark size={collapsedMode ? 28 : 26} />
              {!collapsedMode && <span className="brand-name">Trader OS</span>}
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
          {navGroups.map((group, gi) => {
            const items = NAV.filter((i) => i.group === group);
            return (
              <div key={group} className={gi > 0 ? "nav-group" : ""}>
                {!collapsedMode && <p className="nav-kicker">{GROUP_LABELS[group]}</p>}
                {collapsedMode && gi > 0 && <div className="nav-divider" aria-hidden />}
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = navActive(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={isActive ? "nav-link active" : "nav-link"}
                      onClick={onNavigate}
                      title={collapsedMode ? item.label : undefined}
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon size={20} strokeWidth={1.75} aria-hidden />
                      {!collapsedMode && <span className="nav-label">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
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
          <MarketPulse />
          <header className="top">
            <div className="top-left">
              <button type="button" className="menu" aria-label="Open menu" onClick={() => setNavOpen(true)}>
                Menu
              </button>
              <div className="crumb">
                {active ? `${active.firm} · ${active.program}` : `Times in ${user?.timezone ?? "Africa/Lagos"}`}
              </div>
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
              {active && (
                <div className="eq-chip">
                  <span className="muted">Equity</span>
                  <span className="num">{money(active.current_equity)}</span>
                  <span className={`num ${tone(pnl)}`}>{signed(pnl)}</span>
                </div>
              )}
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
        .brand-block {
          display: flex;
          flex-direction: column;
          margin-bottom: 18px;
          width: 100%;
        }
        .brand-block-collapsed {
          align-items: center;
        }
        .brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          width: 100%;
          min-width: 0;
        }
        .brand-block-collapsed .brand-row {
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
        .brand-name {
          font-weight: 600;
          letter-spacing: 0.06em;
          font-size: 14px;
          white-space: nowrap;
        }
        nav {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          width: 100%;
        }
        .nav-kicker {
          margin: 4px 0 6px;
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
        .nav-label {
          white-space: nowrap;
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
          background: var(--surface);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          gap: 12px;
        }
        .top-left,
        .top-right {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
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
          min-width: 180px;
          max-width: 260px;
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
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
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
          padding: 20px 24px 48px;
          position: relative;
          z-index: 0;
          color: var(--text-primary);
        }
        .page :global(h1) {
          font-size: 30px;
          font-weight: 700;
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
