"use client";

import { useMemo } from "react";

type Pt = { t: string; balance: string | number };

export function EquitySparkline({
  series,
  width = 320,
  height = 56,
}: {
  series: Pt[];
  width?: number;
  height?: number;
}) {
  const path = useMemo(() => {
    const values = series.map((p) => Number(p.balance)).filter((n) => !Number.isNaN(n));
    if (values.length === 0) return { d: "", up: true, flat: true };
    const padded = values.length === 1 ? [values[0], values[0]] : values;
    const min = Math.min(...padded);
    const max = Math.max(...padded);
    const span = max - min || 1;
    const padX = 2;
    const padY = 4;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const pts = padded.map((v, i) => {
      const x = padX + (i / (padded.length - 1)) * innerW;
      const y = padY + innerH - ((v - min) / span) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const first = padded[0];
    const last = padded[padded.length - 1];
    return { d: pts.join(" "), up: last >= first, flat: last === first };
  }, [series, width, height]);

  const stroke = path.flat ? "var(--muted)" : path.up ? "var(--green)" : "var(--red)";

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="1.75" points={path.d} />
    </svg>
  );
}
