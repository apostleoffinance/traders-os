export type CalcPlan = {
  symbol: string;
  direction: "long" | "short";
  entry: string;
  stop_loss?: string | null;
  take_profit?: string | null;
  lot_size?: string | null;
};

const KEY = "traderos.calc_plan";

export function saveCalcPlan(plan: CalcPlan): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY, JSON.stringify(plan));
}

export function consumeCalcPlan(): CalcPlan | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  sessionStorage.removeItem(KEY);
  try {
    return JSON.parse(raw) as CalcPlan;
  } catch {
    return null;
  }
}

export function peekCalcPlan(): CalcPlan | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CalcPlan;
  } catch {
    return null;
  }
}
