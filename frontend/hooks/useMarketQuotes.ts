"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { MARKET_PULSE_POLL_MS, type MarketTickerResponse } from "@/lib/market";

export function useMarketQuotes() {
  const [data, setData] = useState<MarketTickerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await api<MarketTickerResponse>("/api/market/ticker");
      setData(res);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Market data unavailable");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), MARKET_PULSE_POLL_MS);
    const onVis = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  return { data, quotes: data?.quotes ?? [], loading, error, refresh: load };
}
