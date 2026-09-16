"use client";

import { useId, useMemo } from "react";
import type { AnatomyLevelLine, AnatomyPoint, AnatomySeriesPoint, TradeAnatomyModel } from "@/lib/trade-anatomy";
import { pointAtProgress } from "@/lib/trade-anatomy";
import { num, signed } from "@/lib/format";

const W = 480;
const H = 280;
const PAD_X = 52;
const PAD_Y = 28;

function levelStroke(level: AnatomyLevelLine): string {
  if (level.id === "stop" || level.id === "mae") return "var(--neg, var(--danger, #ef4444))";
  if (level.id === "target" || level.id === "mfe") return "var(--pos, #22c55e)";
  if (level.id === "exit") return "var(--text)";
  return "var(--accent)";
}

function levelDash(level: AnatomyLevelLine): string | undefined {
  if (level.kind === "structure" && level.id !== "entry") return "5 4";
  if (level.kind === "excursion") return "2 3";
  return undefined;
}

function polyCoords(points: { t: number; yNorm: number }[]) {
  return points.map((p) => ({
    x: PAD_X + p.t * (W - PAD_X * 2),
    y: PAD_Y + (1 - p.yNorm) * (H - PAD_Y * 2),
    t: p.t,
  }));
}

function fullPathD(points: { t: number; yNorm: number }[]): string {
  const pts = polyCoords(points);
  if (pts.length === 0) return "";
  return pts.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
}

function partialPathD(points: { t: number; yNorm: number }[], progress: number): string {
  if (points.length === 0) return "";
  const t = Math.max(0, Math.min(1, progress));
  const pts = polyCoords(points);
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;

  const out: string[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (t < a.t) break;
    if (out.length === 0) out.push(`M ${a.x.toFixed(1)} ${a.y.toFixed(1)}`);
    if (t >= b.t) {
      out.push(`L ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
    } else {
      const span = b.t - a.t || 1;
      const u = (t - a.t) / span;
      const x = a.x + (b.x - a.x) * u;
      const y = a.y + (b.y - a.y) * u;
      out.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
      break;
    }
  }
  return out.join(" ");
}

function drawPoints(model: TradeAnatomyModel): { t: number; yNorm: number }[] {
  if (model.series && model.series.length >= 2) {
    return model.series.map((s: AnatomySeriesPoint) => ({ t: s.t, yNorm: s.yNorm }));
  }
  return model.path.map((p) => ({ t: p.t, yNorm: p.yNorm }));
}

export function AnatomyChart({
  model,
  progress,
  activeId,
  onSelectPoint,
}: {
  model: TradeAnatomyModel;
  progress: number;
  activeId: AnatomyPoint["id"] | null;
  onSelectPoint?: (id: AnatomyPoint["id"]) => void;
}) {
  const uid = useId();
  const ghostId = `${uid}-ghost`;
  const favorable = model.metrics.realizedR == null ? null : model.metrics.realizedR >= 0;
  const poly = drawPoints(model);

  const cursor = useMemo(
    () => pointAtProgress(model.path, progress, W, H, PAD_X, PAD_Y, model.series),
    [model.path, model.series, progress],
  );

  const stroke =
    favorable === true
      ? "var(--pos, #22c55e)"
      : favorable === false
        ? "var(--neg, var(--danger, #ef4444))"
        : "var(--accent)";

  return (
    <div className="anatomy-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${model.symbol} ${model.direction} trade anatomy from entry to exit`}
      >
        <defs>
          <linearGradient id={ghostId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.15" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {model.levels.map((level) => {
          const y = PAD_Y + (1 - level.yNorm) * (H - PAD_Y * 2);
          const rightLabel = level.kind !== "excursion";
          return (
            <g key={level.id}>
              <line
                x1={PAD_X}
                y1={y}
                x2={W - PAD_X}
                y2={y}
                stroke={levelStroke(level)}
                strokeWidth={level.id === "entry" ? 1.5 : 1}
                strokeDasharray={levelDash(level)}
                opacity={level.kind === "excursion" ? 0.9 : 0.55}
              />
              <text
                x={rightLabel ? W - PAD_X + 6 : PAD_X + 4}
                y={rightLabel ? y + 3 : y - 6}
                fontSize={10}
                fill={levelStroke(level)}
                fontFamily="var(--font-mono), ui-monospace, monospace"
              >
                {level.label}
                {level.r != null ? ` ${signed(level.r, "R")}` : ""}
              </text>
              {level.r != null && (
                <text
                  x={PAD_X - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill="var(--text-secondary)"
                  fontFamily="var(--font-mono), ui-monospace, monospace"
                  opacity={level.kind === "structure" ? 1 : 0.7}
                >
                  {signed(level.r, "R")}
                </text>
              )}
            </g>
          );
        })}

        {poly.length > 1 && (
          <>
            <path
              d={fullPathD(poly)}
              fill="none"
              stroke={`url(#${ghostId})`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={partialPathD(poly, progress)}
              fill="none"
              stroke={stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </>
        )}

        {model.path.map((p) => {
          const x = PAD_X + p.t * (W - PAD_X * 2);
          const y = PAD_Y + (1 - p.yNorm) * (H - PAD_Y * 2);
          const revealed = progress >= p.t - 0.001;
          const active = activeId === p.id;
          if (!revealed && p.id !== "entry") return null;
          return (
            <circle
              key={p.id}
              cx={x}
              cy={y}
              r={active ? 7 : 5}
              fill={
                p.id === "entry"
                  ? "var(--accent)"
                  : p.id === "exit"
                    ? favorable
                      ? "var(--pos, #22c55e)"
                      : "var(--neg, var(--danger, #ef4444))"
                    : p.id === "mfe"
                      ? "var(--pos, #22c55e)"
                      : "var(--neg, var(--danger, #ef4444))"
              }
              stroke="var(--surface)"
              strokeWidth={2}
              role={onSelectPoint ? "button" : undefined}
              tabIndex={onSelectPoint ? 0 : undefined}
              aria-label={`${p.label} at ${num(p.price, 5)}${p.r != null ? `, ${signed(p.r, "R")}` : ""}${p.timed ? "" : " (untimed)"}`}
              style={{ cursor: onSelectPoint ? "pointer" : "default" }}
              onClick={() => onSelectPoint?.(p.id)}
              onKeyDown={(e) => {
                if (!onSelectPoint) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelectPoint(p.id);
                }
              }}
            />
          );
        })}

        <circle cx={cursor.x} cy={cursor.y} r={4} fill="var(--text)" opacity={0.85} aria-hidden />
      </svg>

      <style jsx>{`
        .anatomy-chart {
          background: color-mix(in srgb, var(--surface) 90%, var(--bg));
          border: 1px solid var(--line);
          padding: 10px 10px 8px;
        }
        svg {
          width: 100%;
          height: auto;
          display: block;
        }
      `}</style>
    </div>
  );
}
