"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  THEME_EVENT,
  applyTheme,
  persistTheme,
  readThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("dark");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const pref = readThemePreference();
    setPreferenceState(pref);
    setResolved(applyTheme(pref));
    if (window.localStorage.getItem("traderos-theme") === "system") {
      persistTheme(pref);
    }

    const onTheme = () => {
      const current = readThemePreference();
      setPreferenceState(current);
      setResolved(resolveTheme(current));
    };
    window.addEventListener(THEME_EVENT, onTheme);
    return () => {
      window.removeEventListener(THEME_EVENT, onTheme);
    };
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      setPreference: (next) => {
        setPreferenceState(next);
        setResolved(persistTheme(next));
      },
    }),
    [preference, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      preference: "dark",
      resolved: "dark",
      setPreference: persistTheme,
    };
  }
  return ctx;
}
