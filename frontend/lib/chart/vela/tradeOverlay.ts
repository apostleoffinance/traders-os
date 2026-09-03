export type TradeOverlayLevels = {
  entry?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  exit?: number | null;
  entryTimeMs?: number | null;
  exitTimeMs?: number | null;
};

type DrawingApi = {
  add: (
    type: string,
    init?: {
      anchors?: { time: number; price: number }[];
      style?: Record<string, unknown>;
      text?: { content?: string };
    },
  ) => { id: string } | null;
  remove: (id: string) => void;
};

const COLORS = {
  entry: "#3b82f6",
  stop: "#ef4444",
  target: "#22c55e",
  exit: "#a855f7",
};

function parseNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Map trade / replay payload fields into overlay levels. */
export function levelsFromTrade(trade: {
  entry_price?: string | number | null;
  stop_loss?: string | number | null;
  take_profit?: string | number | null;
  exit_price?: string | number | null;
  trade_timestamp?: string | null;
  exit_timestamp?: string | null;
}): TradeOverlayLevels {
  return {
    entry: parseNum(trade.entry_price),
    stopLoss: parseNum(trade.stop_loss),
    takeProfit: parseNum(trade.take_profit),
    exit: parseNum(trade.exit_price),
    entryTimeMs: trade.trade_timestamp ? Date.parse(trade.trade_timestamp) : null,
    exitTimeMs: trade.exit_timestamp ? Date.parse(trade.exit_timestamp) : null,
  };
}

export function levelsFromReplay(replay: {
  levels?: {
    entry?: string | number | null;
    stop_loss?: string | number | null;
    take_profit?: string | number | null;
    exit?: string | number | null;
  };
  timeline?: { phase?: string; at?: string; price?: string | null }[];
}): TradeOverlayLevels {
  const entryEv = replay.timeline?.find((e) => e.phase === "entry");
  const exitEv = replay.timeline?.find((e) => e.phase === "exit" || e.phase === "close");
  return {
    entry: parseNum(replay.levels?.entry),
    stopLoss: parseNum(replay.levels?.stop_loss),
    takeProfit: parseNum(replay.levels?.take_profit),
    exit: parseNum(replay.levels?.exit),
    entryTimeMs: entryEv?.at ? Date.parse(entryEv.at) : null,
    exitTimeMs: exitEv?.at ? Date.parse(exitEv.at) : null,
  };
}

/**
 * Paint entry / SL / TP / exit as horizontal lines via Vela drawings API.
 * Returns drawing ids so the caller can clear them on change.
 */
export function applyTradeOverlay(
  drawings: DrawingApi,
  levels: TradeOverlayLevels,
  anchorTimeMs: number,
): string[] {
  const ids: string[] = [];
  const t = Number.isFinite(anchorTimeMs) && anchorTimeMs > 0 ? anchorTimeMs : Date.now();

  const addH = (price: number | null | undefined, color: string, label: string) => {
    if (price == null || !Number.isFinite(price)) return;
    const d = drawings.add("hline", {
      anchors: [{ time: t, price }],
      style: { lineColor: color, lineWidth: 2, lineStyle: "dashed" },
      text: { content: label },
    });
    if (d?.id) ids.push(d.id);
  };

  addH(levels.entry, COLORS.entry, "Entry");
  addH(levels.stopLoss, COLORS.stop, "SL");
  addH(levels.takeProfit, COLORS.target, "TP");
  addH(levels.exit, COLORS.exit, "Exit");

  if (levels.entryTimeMs && Number.isFinite(levels.entryTimeMs)) {
    const d = drawings.add("vline", {
      anchors: [{ time: levels.entryTimeMs, price: levels.entry ?? 0 }],
      style: { lineColor: COLORS.entry, lineWidth: 1, lineStyle: "dotted" },
      text: { content: "Entry time" },
    });
    if (d?.id) ids.push(d.id);
  }

  return ids;
}

export function clearTradeOverlay(drawings: DrawingApi, ids: string[]) {
  for (const id of ids) {
    try {
      drawings.remove(id);
    } catch {
      /* ignore */
    }
  }
}
