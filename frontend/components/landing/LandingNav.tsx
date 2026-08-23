"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { primaryHref, primaryLabel, useSignedIn } from "./useSignedIn";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#intelligence", label: "Intelligence" },
  { href: "/#risk", label: "Risk" },
  { href: "/#community", label: "Community" },
];

export function LandingNav() {
  const signedIn = useSignedIn();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onResize() {
      if (window.innerWidth > 768) setOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const cta = (
    <Link href={primaryHref(signedIn)} className="lp-cta" onClick={() => setOpen(false)}>
      {primaryLabel(signedIn)}
    </Link>
  );

  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        <Link href="/" className="lp-brand" onClick={() => setOpen(false)}>
          <BrandMark size={32} />
          <span className="lp-brand-copy">
            <span className="lp-brand-name">Trader OS</span>
            <span className="lp-brand-tag">Journal · Discipline · Intelligence</span>
          </span>
        </Link>
        <nav className="lp-nav-links" aria-label="Landing">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="lp-nav-right">
          <span className="lp-nav-theme">
            <ThemeToggle />
          </span>
          <Link href="/login" className="lp-login">
            Log in
          </Link>
          {cta}
          <button type="button" className="lp-menu" aria-label="Open menu" onClick={() => setOpen(true)}>
            Menu
          </button>
        </div>
      </div>
      {open && (
        <div className="lp-drawer" role="dialog" aria-label="Menu">
          <button type="button" className="lp-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="lp-drawer-panel">
            <div className="lp-drawer-head">
              <span className="lp-drawer-brand">
                <BrandMark size={28} />
                <span className="lp-brand-name">Trader OS</span>
              </span>
              <button type="button" className="lp-menu" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="lp-brand-tag drawer-tag">Journal · Discipline · Intelligence</p>
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </a>
            ))}
            <div className="lp-drawer-foot">
              <ThemeToggle />
              <Link href="/login" className="lp-login" onClick={() => setOpen(false)}>
                Log in
              </Link>
              {cta}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
