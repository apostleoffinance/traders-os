"use client";

import { useEffect, useState } from "react";
import { hasSession } from "@/lib/api";

export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    function sync() {
      setSignedIn(hasSession());
    }
    sync();
    window.addEventListener("traderos-session", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("traderos-session", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return signedIn;
}

export function primaryHref(signedIn: boolean): string {
  return signedIn ? "/dashboard" : "/register";
}

export function primaryLabel(signedIn: boolean): string {
  return signedIn ? "Open workspace" : "Get started";
}
