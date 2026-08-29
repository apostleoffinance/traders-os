"""Rolling window metrics for Quant Lab."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.fx_math import ZERO, money, ratio


DEFAULT_WINDOWS = (10, 20, 30, 50, 100)
UI_WINDOWS = (20, 50, 100)


def _profit_factor(values: list[Decimal]) -> Decimal | None:
    wins = sum((v for v in values if v > ZERO), ZERO)
    losses = abs(sum((v for v in values if v < ZERO), ZERO))
    if losses == ZERO:
        return None
    return ratio(wins / losses)


def _rolling_point(
    window: Sequence[AnalyticsTrade],
    *,
    trade_index: int,
    exit_at: str,
    window_size: int,
) -> dict:
    pnls = [t.net_pnl for t in window]
    rs = [t.r_multiple for t in window if t.r_multiple is not None]
    wins = [t for t in window if t.classify_outcome() == "win"]
    losses = [t for t in window if t.classify_outcome() == "loss"]
    n = len(window)
    win_rate = Decimal(len(wins)) / Decimal(n) if n else None
    avg_win = sum((t.net_pnl for t in wins), ZERO) / Decimal(len(wins)) if wins else None
    avg_loss = sum((t.net_pnl for t in losses), ZERO) / Decimal(len(losses)) if losses else None
    payoff = None
    if avg_win is not None and avg_loss is not None and avg_loss != ZERO:
        payoff = ratio(avg_win / abs(avg_loss))
    exp_r = ratio(sum(rs, ZERO) / Decimal(len(rs))) if rs else None
    return {
        "trade_number": trade_index,
        "exit_at": exit_at,
        "window_size": window_size,
        "expectancy_r": exp_r,
        "win_rate": ratio(win_rate * Decimal("100")) if win_rate is not None else None,
        "profit_factor": _profit_factor(pnls),
        "average_win": money(avg_win) if avg_win is not None else None,
        "average_loss": money(avg_loss) if avg_loss is not None else None,
        "payoff_ratio": payoff,
    }


def build_rolling(
    trades: Sequence[AnalyticsTrade],
    *,
    windows: Sequence[int] = DEFAULT_WINDOWS,
) -> dict:
    ordered = list(trades)
    n = len(ordered)
    series: dict[int, list[dict]] = {w: [] for w in windows}
    for i, t in enumerate(ordered):
        exit_at = t.exit_at.isoformat() if t.exit_at else ""
        for w in windows:
            if i + 1 < w:
                series[w].append(
                    {
                        "trade_number": i + 1,
                        "exit_at": exit_at,
                        "window_size": w,
                        "expectancy_r": None,
                        "win_rate": None,
                        "profit_factor": None,
                        "average_win": None,
                        "average_loss": None,
                        "payoff_ratio": None,
                    }
                )
                continue
            window = ordered[i + 1 - w : i + 1]
            series[w].append(_rolling_point(window, trade_index=i + 1, exit_at=exit_at, window_size=w))
    return {
        "windows": list(windows),
        "default_windows": list(UI_WINDOWS),
        "series": {str(w): series[w] for w in windows},
        "n": n,
        "category": "OBSERVED_PERFORMANCE",
        "note": "Rolling metrics use null until the window is full.",
    }
