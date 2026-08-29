export type Point2 = { x: number; y: number };

export function linearRegression(points: Point2[]): { slope: number; intercept: number; line: [number, number][] } | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  return {
    slope,
    intercept,
    line: [
      [minX, slope * minX + intercept],
      [maxX, slope * maxX + intercept],
    ],
  };
}

export function captureHistogramBins(
  scatter: { capture_ratio: string | null; trade_id: string }[],
): { label: string; n: number; tradeIds: string[] }[] {
  const edges = [
    { label: "0–25%", min: 0, max: 0.25 },
    { label: "25–50%", min: 0.25, max: 0.5 },
    { label: "50–75%", min: 0.5, max: 0.75 },
    { label: "75–100%", min: 0.75, max: 1.01 },
    { label: ">100%", min: 1.01, max: Infinity },
  ];
  return edges.map(({ label, min, max }) => {
    const tradeIds = scatter
      .filter((p) => {
        const cap = Number(p.capture_ratio ?? 0);
        return cap >= min && cap < max;
      })
      .map((p) => p.trade_id);
    return { label, n: tradeIds.length, tradeIds };
  });
}
