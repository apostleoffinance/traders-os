"use client";

import { useLiveChart } from "@/components/analytics/Charts";

export function MiniSparkline({ values, height = 28 }: { values: number[]; height?: number }) {
  const { C } = useLiveChart();
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  const first = values[0];
  const stroke = last >= first ? C.pos : C.neg;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="spark" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" />
      <style jsx>{`
        .spark {
          width: 100%;
          height: ${height}px;
          margin-top: 6px;
        }
      `}</style>
    </svg>
  );
}
