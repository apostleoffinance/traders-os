import type { TradeReplay, TradeReplayPriceSeriesPoint } from "@/lib/trade-replay";

export type AnatomyPointId = "entry" | "mae" | "mfe" | "exit";

export type AnatomyPoint = {
  id: AnatomyPointId;
  label: string;
  price: number;
  /** Signed R from entry using stop distance; null if risk distance unavailable. */
  r: number | null;
  /** Progress along hold / schematic path [0, 1]. */
  t: number;
  /** Normalized price position [0, 1] for SVG (0 = bottom of range). */
  yNorm: number;
  timed: boolean;
  at?: string | null;
};

export type AnatomySeriesPoint = {
  t: number;
  price: number;
  yNorm: number;
  at: string;
  high: number;
  low: number;
};

export type AnatomyLevelLine = {
  id: "entry" | "stop" | "target" | "exit" | "mfe" | "mae";
  label: string;
  price: number;
  r: number | null;
  yNorm: number;
  kind: "structure" | "excursion" | "outcome";
};

export type AnatomyMetrics = {
  plannedR: number | null;
  realizedR: number | null;
  mfeR: number | null;
  maeR: number | null;
  /** realizedR / mfeR when mfeR > 0; otherwise null. */
  capture: number | null;
  holdSeconds: number | null;
  riskAmount: number | null;
};

export type AnatomyStory = {
  what: string;
  soWhat: string;
  nowWhat: string;
  direction: "positive" | "negative" | "neutral";
  warning?: string;
};

export type TradeAnatomyModel = {
  symbol: string;
  direction: "long" | "short";
  status: string;
  timeframe: string;
  session: string;
  riskDistance: number | null;
  levels: AnatomyLevelLine[];
  /** Marker points (entry / MAE / MFE / exit). */
  path: AnatomyPoint[];
  /** OHLC close series when available — used for the drawn polyline. */
  series: AnatomySeriesPoint[] | null;
  metrics: AnatomyMetrics;
  pathMode: "schematic" | "excursion_aware" | "ohlc";
  hasExcursions: boolean;
  timingNote: string | null;
  story: AnatomyStory;
};

export type TradeAnatomyFallbacks = {
  mfeR?: string | null;
  maeR?: string | null;
  mfePrice?: string | null;
  maePrice?: string | null;
  mfeAt?: string | null;
  maeAt?: string | null;
  realizedR?: string | null;
  plannedRr?: string | null;
  holdSeconds?: number | null;
};

function parseNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function rFromPrice(
  price: number,
  entry: number,
  riskDistance: number | null,
  isLong: boolean,
): number | null {
  if (riskDistance == null || riskDistance <= 0) return null;
  const raw = isLong ? (price - entry) / riskDistance : (entry - price) / riskDistance;
  return Math.round(raw * 100) / 100;
}

function yNormFor(price: number, lo: number, hi: number): number {
  const span = hi - lo || 1e-9;
  return (price - lo) / span;
}

function buildStory(model: Omit<TradeAnatomyModel, "story">): AnatomyStory {
  const { metrics, direction, hasExcursions, status, pathMode } = model;
  const isLong = direction === "long";
  const dirWord = isLong ? "long" : "short";

  if (status !== "closed") {
    return {
      what: `Open ${dirWord} still running — anatomy shows planned structure only.`,
      soWhat: "Exit and excursion metrics appear once the trade closes.",
      nowWhat: "Review entry checklist and risk while the position is live.",
      direction: "neutral",
    };
  }

  const realized = metrics.realizedR;
  const mfe = metrics.mfeR;
  const mae = metrics.maeR;
  const planned = metrics.plannedR;
  const capture = metrics.capture;

  const whatParts: string[] = [];
  if (realized != null) whatParts.push(`Closed at ${realized >= 0 ? "+" : ""}${realized.toFixed(2)}R`);
  if (mfe != null) whatParts.push(`MFE ${mfe >= 0 ? "+" : ""}${mfe.toFixed(2)}R`);
  if (mae != null) whatParts.push(`MAE ${mae >= 0 ? "+" : ""}${mae.toFixed(2)}R`);
  if (planned != null) whatParts.push(`planned ${planned.toFixed(2)}R`);
  const what =
    whatParts.length > 0
      ? whatParts.join(" · ")
      : `Closed ${dirWord} — limited R metrics available for this trade.`;

  let soWhat = "Review how structure and outcome lined up.";
  let nowWhat = "Compare this trade to similar setups in Edge Lab.";
  let tone: AnatomyStory["direction"] = "neutral";
  let warning: string | undefined;

  if (capture != null && mfe != null && mfe > 0) {
    const pct = Math.round(capture * 100);
    if (capture < 0.5 && realized != null && realized > 0) {
      soWhat = `You captured about ${pct}% of available excursion (${realized.toFixed(2)}R of ${mfe.toFixed(2)}R MFE).`;
      nowWhat = "Ask whether your exit rule leaves edge on the table on winners.";
      tone = "negative";
    } else if (capture >= 0.85) {
      soWhat = `Strong capture (~${pct}% of MFE) — exit held most of the move.`;
      nowWhat = "Keep the exit rule that preserved this capture.";
      tone = "positive";
    } else if (realized != null && realized < 0 && mfe > 0.5) {
      soWhat = `Trade went +${mfe.toFixed(2)}R in your favor before finishing ${realized.toFixed(2)}R.`;
      nowWhat = "Study whether management or invalidation flipped a winner.";
      tone = "negative";
    } else {
      soWhat = `Capture ~${pct}% of MFE.`;
      nowWhat = "Track capture across similar setups for a pattern.";
      tone = capture >= 0.65 ? "positive" : "neutral";
    }
  } else if (planned != null && realized != null) {
    if (realized >= planned * 0.9) {
      soWhat = `Realized ${realized.toFixed(2)}R near planned ${planned.toFixed(2)}R.`;
      nowWhat = "Process and target alignment look healthy here.";
      tone = "positive";
    } else if (realized > 0 && realized < planned * 0.85) {
      soWhat = `Took ${realized.toFixed(2)}R vs planned ${planned.toFixed(2)}R — early relative to plan.`;
      nowWhat = "Check if fear or a valid invalidation drove the early exit.";
      tone = "negative";
    } else if (realized < 0) {
      soWhat = `Loss of ${realized.toFixed(2)}R against a ${planned.toFixed(2)}R plan.`;
      nowWhat = "Confirm stop placement and whether the setup was still valid.";
      tone = "negative";
    }
  } else if (!hasExcursions) {
    soWhat = "Excursion (MFE/MAE) data is not available for this trade yet.";
    nowWhat = "Once sync enrichment lands, anatomy will show capture and adverse excursion.";
    warning = "Path is schematic (entry → exit). No invented OHLC.";
  }

  if (pathMode !== "ohlc" && hasExcursions && model.path.some((p) => !p.timed && p.id !== "entry" && p.id !== "exit")) {
    warning = "MFE/MAE path order is schematic — timestamps for peaks are not available.";
  }

  return { what, soWhat, nowWhat, direction: tone, warning };
}

function seriesFromReplay(
  points: TradeReplayPriceSeriesPoint[],
  rangeLo: number,
  rangeHi: number,
): AnatomySeriesPoint[] {
  return points.map((p) => {
    const close = parseNum(p.close) ?? 0;
    const high = parseNum(p.high) ?? close;
    const low = parseNum(p.low) ?? close;
    return {
      t: p.t,
      price: close,
      yNorm: yNormFor(close, rangeLo, rangeHi),
      at: p.at,
      high,
      low,
    };
  });
}

/**
 * Build a Trade Anatomy view model from replay payload (+ optional trade fallbacks).
 * Does not invent OHLC or timed MFE/MAE — uses series/timestamps only when present.
 */
export function buildTradeAnatomyModel(
  replay: TradeReplay,
  fallbacks?: TradeAnatomyFallbacks,
): TradeAnatomyModel {
  const isLong = replay.direction === "long";
  const entry = parseNum(replay.levels.entry)!;
  const stop = parseNum(replay.levels.stop_loss)!;
  const target = parseNum(replay.levels.take_profit);
  const exit = parseNum(replay.levels.exit);

  const exc = replay.excursions;
  const mfePrice = parseNum(exc?.mfe_price ?? fallbacks?.mfePrice);
  const maePrice = parseNum(exc?.mae_price ?? fallbacks?.maePrice);
  const mfeR = parseNum(exc?.mfe_r ?? fallbacks?.mfeR);
  const maeR = parseNum(exc?.mae_r ?? fallbacks?.maeR);
  const mfeAt = exc?.mfe_at ?? fallbacks?.mfeAt ?? null;
  const maeAt = exc?.mae_at ?? fallbacks?.maeAt ?? null;
  const mfeT = typeof exc?.mfe_t === "number" ? exc.mfe_t : null;
  const maeT = typeof exc?.mae_t === "number" ? exc.mae_t : null;

  const realizedR = parseNum(replay.metrics?.realized_r ?? replay.decision_quality.outcome_r ?? fallbacks?.realizedR);
  const plannedR = parseNum(replay.metrics?.planned_rr ?? fallbacks?.plannedRr);
  const holdSeconds =
    replay.metrics?.holding_time_seconds ??
    fallbacks?.holdSeconds ??
    replay.timeline.find((e) => e.phase === "hold")?.duration_seconds ??
    null;
  const riskAmount = parseNum(replay.metrics?.risk_amount);

  const riskDistance = Math.abs(entry - stop) || null;

  const prices = [entry, stop];
  if (target != null) prices.push(target);
  if (exit != null) prices.push(exit);
  if (mfePrice != null) prices.push(mfePrice);
  if (maePrice != null) prices.push(maePrice);

  const seriesPoints = replay.price_series?.points ?? [];
  for (const p of seriesPoints) {
    const c = parseNum(p.close);
    const h = parseNum(p.high);
    const l = parseNum(p.low);
    if (c != null) prices.push(c);
    if (h != null) prices.push(h);
    if (l != null) prices.push(l);
  }

  if (mfePrice == null && mfeR != null && riskDistance) {
    prices.push(isLong ? entry + mfeR * riskDistance : entry - mfeR * riskDistance);
  }
  if (maePrice == null && maeR != null && riskDistance) {
    // maeR stored as non-negative adverse distance in backend; for display R we want signed.
    prices.push(isLong ? entry - Math.abs(maeR) * riskDistance : entry + Math.abs(maeR) * riskDistance);
  }

  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const pad = (hi - lo) * 0.08 || 0.0001;
  const rangeLo = lo - pad;
  const rangeHi = hi + pad;

  const resolvePrice = (price: number | null, r: number | null, adverse = false): number | null => {
    if (price != null) return price;
    if (r != null && riskDistance) {
      const mag = Math.abs(r);
      if (adverse) {
        return isLong ? entry - mag * riskDistance : entry + mag * riskDistance;
      }
      return isLong ? entry + r * riskDistance : entry - r * riskDistance;
    }
    return null;
  };

  const mfePx = resolvePrice(mfePrice, mfeR, false);
  const maePx = resolvePrice(maePrice, maeR, true);

  const hasExcursions = mfePx != null || maePx != null || mfeR != null || maeR != null;
  const hasSeries = seriesPoints.length >= 2;

  const levels: AnatomyLevelLine[] = [
    {
      id: "stop",
      label: "Stop",
      price: stop,
      r: rFromPrice(stop, entry, riskDistance, isLong),
      yNorm: yNormFor(stop, rangeLo, rangeHi),
      kind: "structure",
    },
    {
      id: "entry",
      label: "Entry",
      price: entry,
      r: 0,
      yNorm: yNormFor(entry, rangeLo, rangeHi),
      kind: "structure",
    },
  ];
  if (target != null) {
    levels.push({
      id: "target",
      label: "Target",
      price: target,
      r: rFromPrice(target, entry, riskDistance, isLong),
      yNorm: yNormFor(target, rangeLo, rangeHi),
      kind: "structure",
    });
  }
  if (maePx != null) {
    levels.push({
      id: "mae",
      label: "MAE",
      price: maePx,
      r: maeR != null ? -Math.abs(maeR) : rFromPrice(maePx, entry, riskDistance, isLong),
      yNorm: yNormFor(maePx, rangeLo, rangeHi),
      kind: "excursion",
    });
  }
  if (mfePx != null) {
    levels.push({
      id: "mfe",
      label: "MFE",
      price: mfePx,
      r: mfeR ?? rFromPrice(mfePx, entry, riskDistance, isLong),
      yNorm: yNormFor(mfePx, rangeLo, rangeHi),
      kind: "excursion",
    });
  }
  if (exit != null) {
    levels.push({
      id: "exit",
      label: "Exit",
      price: exit,
      r: realizedR ?? rFromPrice(exit, entry, riskDistance, isLong),
      yNorm: yNormFor(exit, rangeLo, rangeHi),
      kind: "outcome",
    });
  }

  const path: AnatomyPoint[] = [
    {
      id: "entry",
      label: "Entry",
      price: entry,
      r: 0,
      t: 0,
      yNorm: yNormFor(entry, rangeLo, rangeHi),
      timed: true,
    },
  ];

  const mid: AnatomyPoint[] = [];
  if (maePx != null) {
    const timed = maeT != null || maeAt != null;
    mid.push({
      id: "mae",
      label: "MAE",
      price: maePx,
      r: maeR != null ? -Math.abs(maeR) : rFromPrice(maePx, entry, riskDistance, isLong),
      t: maeT ?? 0,
      yNorm: yNormFor(maePx, rangeLo, rangeHi),
      timed,
      at: maeAt,
    });
  }
  if (mfePx != null) {
    const timed = mfeT != null || mfeAt != null;
    mid.push({
      id: "mfe",
      label: "MFE",
      price: mfePx,
      r: mfeR ?? rFromPrice(mfePx, entry, riskDistance, isLong),
      t: mfeT ?? 0,
      yNorm: yNormFor(mfePx, rangeLo, rangeHi),
      timed,
      at: mfeAt,
    });
  }
  if (exit != null) {
    mid.push({
      id: "exit",
      label: "Exit",
      price: exit,
      r: realizedR ?? rFromPrice(exit, entry, riskDistance, isLong),
      t: 1,
      yNorm: yNormFor(exit, rangeLo, rangeHi),
      timed: true,
    });
  }

  const allTimed = mid.every((p) => p.id === "exit" || p.timed);
  if (allTimed && mid.some((p) => p.id === "mae" || p.id === "mfe")) {
    mid.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
  } else {
    // Schematic fallback: entry → MAE → MFE → exit
    const step = mid.length > 0 ? 1 / mid.length : 1;
    mid.forEach((p, i) => {
      if (!p.timed) p.t = Math.round((i + 1) * step * 1000) / 1000;
    });
  }
  path.push(...mid);

  const series = hasSeries ? seriesFromReplay(seriesPoints, rangeLo, rangeHi) : null;

  const capture =
    mfeR != null && mfeR > 0 && realizedR != null ? Math.round((realizedR / mfeR) * 1000) / 1000 : null;

  let timingNote: string | null;
  let pathMode: TradeAnatomyModel["pathMode"];
  if (hasSeries) {
    pathMode = "ohlc";
    timingNote = replay.price_series?.downsampled
      ? `M1 OHLC path (${replay.price_series.bar_count} bars, downsampled for display). MFE/MAE at first-touch bar.`
      : `M1 OHLC path (${replay.price_series?.bar_count ?? series!.length} bars). MFE/MAE at first-touch bar.`;
  } else if (hasExcursions && allTimed) {
    pathMode = "excursion_aware";
    timingNote = "Timed MFE/MAE markers (bar precision). OHLC series unavailable for this window.";
  } else if (hasExcursions) {
    pathMode = "excursion_aware";
    timingNote =
      "MFE/MAE markers use stored excursion values; path order is schematic (timestamps not available).";
  } else {
    pathMode = "schematic";
    timingNote = "Schematic path from entry to exit — no OHLC candle series on this view.";
  }

  const base: Omit<TradeAnatomyModel, "story"> = {
    symbol: replay.symbol,
    direction: isLong ? "long" : "short",
    status: replay.status,
    timeframe: replay.timeframe,
    session: replay.session,
    riskDistance,
    levels,
    path,
    series,
    metrics: {
      plannedR,
      realizedR,
      mfeR,
      maeR: maeR != null ? -Math.abs(maeR) : null,
      capture,
      holdSeconds,
      riskAmount,
    },
    pathMode,
    hasExcursions,
    timingNote,
  };

  return { ...base, story: buildStory(base) };
}

type PolyPoint = { t: number; yNorm: number };

/** Interpolate along marker path or OHLC series by progress t ∈ [0,1]. */
export function pointAtProgress(
  path: AnatomyPoint[],
  progress: number,
  width: number,
  height: number,
  padX: number,
  padY: number,
  series?: AnatomySeriesPoint[] | null,
): { x: number; y: number; nearest: AnatomyPoint; price: number | null } {
  const t = Math.max(0, Math.min(1, progress));
  const poly: PolyPoint[] =
    series && series.length >= 2
      ? series.map((s) => ({ t: s.t, yNorm: s.yNorm }))
      : path.map((p) => ({ t: p.t, yNorm: p.yNorm }));

  const nearest =
    path.reduce((best, p) => (Math.abs(p.t - t) < Math.abs(best.t - t) ? p : best), path[0]) ??
    ({
      id: "entry" as const,
      label: "Entry",
      price: 0,
      r: 0,
      t: 0,
      yNorm: 0.5,
      timed: true,
    } satisfies AnatomyPoint);

  if (poly.length === 0) {
    return { x: padX, y: height / 2, nearest, price: null };
  }
  if (poly.length === 1) {
    return {
      x: padX + poly[0].t * (width - padX * 2),
      y: padY + (1 - poly[0].yNorm) * (height - padY * 2),
      nearest,
      price: series?.[0]?.price ?? nearest.price,
    };
  }

  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      const u = (t - a.t) / span;
      const x = padX + (a.t + (b.t - a.t) * u) * (width - padX * 2);
      const yNorm = a.yNorm + (b.yNorm - a.yNorm) * u;
      const y = padY + (1 - yNorm) * (height - padY * 2);
      let price: number | null = nearest.price;
      if (series && series.length >= 2) {
        const sa = series[i];
        const sb = series[i + 1];
        price = sa.price + (sb.price - sa.price) * u;
      }
      return { x, y, nearest, price };
    }
  }
  const last = poly[poly.length - 1];
  return {
    x: padX + last.t * (width - padX * 2),
    y: padY + (1 - last.yNorm) * (height - padY * 2),
    nearest,
    price: series?.[series.length - 1]?.price ?? nearest.price,
  };
}
