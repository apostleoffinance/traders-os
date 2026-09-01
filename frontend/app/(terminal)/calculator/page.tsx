"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TradeCalculator } from "@/components/TradeCalculator";
import { normalizeInstrumentParam } from "@/lib/market";

const ALLOWED = [
  "EURUSD",
  "GBPUSD",
  "AUDUSD",
  "NZDUSD",
  "USDJPY",
  "USDCAD",
  "USDCHF",
  "XAUUSD",
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
];

function CalculatorContent() {
  const searchParams = useSearchParams();
  const instrument = normalizeInstrumentParam(searchParams.get("instrument"), ALLOWED);
  return <TradeCalculator initial={instrument ? { symbol: instrument } : undefined} />;
}

export default function CalculatorPage() {
  return (
    <Suspense fallback={<p className="muted">Loading calculator…</p>}>
      <CalculatorContent />
    </Suspense>
  );
}
