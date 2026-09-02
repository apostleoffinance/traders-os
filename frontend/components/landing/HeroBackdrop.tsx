"use client";

import Image from "next/image";
import { useTheme } from "@/components/ThemeProvider";

export function HeroBackdrop() {
  const { resolved } = useTheme();
  const isDark = resolved === "dark";

  return (
    <div className="lp-hero-backdrop" aria-hidden>
      <div className={`lp-hero-photo${isDark ? " is-active" : ""}`}>
        <Image
          src="/brand/hero-trader-dark.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="lp-hero-img"
        />
      </div>
      <div className={`lp-hero-photo${!isDark ? " is-active" : ""}`}>
        <Image
          src="/brand/hero-trader-light.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="lp-hero-img"
        />
      </div>
      <div className="lp-hero-scrim" />
    </div>
  );
}
