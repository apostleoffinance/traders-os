/** Backend TraderOS timeframe codes. */
export type BackendTimeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1";

/** Vela canonical timeframe strings (minutes or 1D). */
export type VelaTimeframe = "1" | "5" | "15" | "30" | "60" | "240" | "1D";

export const BACKEND_TO_VELA: Record<BackendTimeframe, VelaTimeframe> = {
  M1: "1",
  M5: "5",
  M15: "15",
  M30: "30",
  H1: "60",
  H4: "240",
  D1: "1D",
};

export const VELA_TO_BACKEND: Record<VelaTimeframe, BackendTimeframe> = {
  "1": "M1",
  "5": "M5",
  "15": "M15",
  "30": "M30",
  "60": "H1",
  "240": "H4",
  "1D": "D1",
};

export const POC_TIMEFRAMES: { backend: BackendTimeframe; vela: VelaTimeframe; label: string }[] = [
  { backend: "M5", vela: "5", label: "5m" },
  { backend: "M15", vela: "15", label: "15m" },
  { backend: "M30", vela: "30", label: "30m" },
  { backend: "H1", vela: "60", label: "1H" },
  { backend: "H4", vela: "240", label: "4H" },
  { backend: "D1", vela: "1D", label: "1D" },
];

export function toBackendTimeframe(vela: string): BackendTimeframe | null {
  return (VELA_TO_BACKEND as Record<string, BackendTimeframe>)[vela] ?? null;
}

export function toVelaTimeframe(backend: string): VelaTimeframe | null {
  return (BACKEND_TO_VELA as Record<string, VelaTimeframe>)[backend] ?? null;
}
