"use client";

import { useEffect, useState } from "react";
import { getAccessToken } from "@/lib/api";

export function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(getAccessToken()));
  }, []);

  return signedIn;
}

export function primaryHref(signedIn: boolean): string {
  return signedIn ? "/dashboard" : "/register";
}

export function primaryLabel(signedIn: boolean): string {
  return signedIn ? "Open workspace" : "Get started";
}
