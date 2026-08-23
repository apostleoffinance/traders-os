"""Statistically conservative performance metrics.

Sharpe / Sortino are withheld unless the sample and return frequency make
them meaningful. Every grouped statistic carries its sample size.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from decimal import Decimal
from math import sqrt
from typing import Iterable, Sequence

from app.core.enums import TradeResult, TradeStatus
from app.engines.fx_math import ZERO, money, ratio
from app.engines.risk_engine import ClosedTrade, build_equity_curve

MIN_SHARPE_N = 30
MIN_INSIGHT_N = 10


@dataclass
class SampleNote:
    available: bool
    reason: str | None = None
    n: int = 0


@dataclass
class PerformanceMetrics:
    n_trades: int
    n_wins: int
    n_losses: int
    n_be: int
    win_rate: Decimal | None
    net_pnl: Decimal
    gross_profit: Decimal
    gross_loss: Decimal
    average_win: Decimal | None
    average_loss: Decimal | None
    expectancy_r: Decimal | None
    expectancy_currency: Decimal | None
    profit_factor: Decimal | None
    average_r: Decimal | None
    average_win_r: Decimal | None
    average_loss_r: Decimal | None
    max_drawdown: Decimal
    max_drawdown_pct: Decimal
    recovery_factor: Decimal | None
    consecutive_losses: int
    consecutive_wins: int
    max_consecutive_losses: int
    max_consecutive_wins: int
    sharpe: Decimal | None
    sortino: Decimal | None
    sharpe_note: SampleNote
    sortino_note: SampleNote
    sample_note: str | None = None


@dataclass
class GroupStats:
    key: str
    n: int
    net_pnl: Decimal
    expectancy_r: Decimal | None
    win_rate: Decimal | None
    average_r: Decimal | None
    profit_factor: Decimal | None
    insight: str | None = None


def _closed(trades: Sequence[ClosedTrade]) -> list[ClosedTrade]:
    return [t for t in trades if t.status == TradeStatus.CLOSED]


def _r_values(trades: Sequence[ClosedTrade]) -> list[Decimal]:
    out: list[Decimal] = []
    for t in trades:
        if t.risk_amount > ZERO:
            out.append(t.realized_pnl / t.risk_amount)
    return out


def _mean(values: Sequence[Decimal]) -> Decimal | None:
    if not values:
        return None
    return sum(values, ZERO) / Decimal(len(values))


def _stdev_sample(values: Sequence[Decimal]) -> Decimal | None:
    n = len(values)
    if n < 2:
        return None
    mu = _mean(values)
    assert mu is not None
    var = sum(((v - mu) ** 2 for v in values), ZERO) / Decimal(n - 1)
    if var < ZERO:
        return ZERO
    return Decimal(str(sqrt(float(var))))


def _max_streak(results: Sequence[TradeResult], target: TradeResult) -> int:
    best = cur = 0
    for r in results:
        if r == target:
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    return best


def compute_performance(
    trades: Sequence[ClosedTrade],
    starting_balance: Decimal,
) -> PerformanceMetrics:
    closed = _closed(trades)
    n = len(closed)
    wins = [t for t in closed if t.result == TradeResult.WIN]
    losses = [t for t in closed if t.result == TradeResult.LOSS]
    bes = [t for t in closed if t.result == TradeResult.BREAKEVEN]
    net = money(sum((t.realized_pnl for t in closed), ZERO))
    gp = money(sum((t.realized_pnl for t in wins), ZERO))
    gl = money(abs(sum((t.realized_pnl for t in losses), ZERO)))
    r_vals = _r_values(closed)
    win_r = _r_values(wins)
    loss_r = _r_values(losses)

    win_rate = ratio(Decimal(len(wins)) / Decimal(n) * Decimal("100")) if n else None
    avg_win = money(_mean([t.realized_pnl for t in wins]) or ZERO) if wins else None
    avg_loss = money(_mean([t.realized_pnl for t in losses]) or ZERO) if losses else None
    exp_r = ratio(_mean(r_vals)) if r_vals else None
    exp_ccy = money(net / Decimal(n)) if n else None
    pf = ratio(gp / gl) if gl > ZERO else (None if gp == ZERO else None)
    # profit factor is undefined if no losses; expose None with sample note
    profit_factor = None
    if gl > ZERO:
        profit_factor = ratio(gp / gl)
    avg_r = exp_r
    curve = build_equity_curve(starting_balance, closed)
    max_dd = money(max((p.drawdown for p in curve), default=ZERO))
    max_dd_pct = max((p.drawdown_pct for p in curve), default=ZERO)
    recovery = ratio(net / max_dd) if max_dd > ZERO else None

    ordered = sorted(closed, key=lambda t: t.exit_at or t.entry_at)
    results = [t.result for t in ordered]
    from app.engines.risk_engine import consecutive_results

    consec_l, consec_w = consecutive_results(closed)

    sharpe = None
    sortino = None
    sharpe_note = SampleNote(False, f"Sharpe unavailable — fewer than {MIN_SHARPE_N} observations.", n)
    sortino_note = SampleNote(False, f"Sortino unavailable — fewer than {MIN_SHARPE_N} observations.", n)
    if len(r_vals) >= MIN_SHARPE_N:
        mu = _mean(r_vals)
        sd = _stdev_sample(r_vals)
        if mu is not None and sd and sd > ZERO:
            sharpe = ratio(mu / sd)
            sharpe_note = SampleNote(True, None, len(r_vals))
        else:
            sharpe_note = SampleNote(False, "Sharpe unavailable — zero variance in R-multiples.", len(r_vals))
        downside = [min(v, ZERO) for v in r_vals]
        # Sortino uses downside deviation of returns below 0
        neg = [v for v in r_vals if v < ZERO]
        if mu is not None and len(neg) >= 2:
            dsd = _stdev_sample(neg)
            if dsd and dsd > ZERO:
                sortino = ratio(mu / dsd)
                sortino_note = SampleNote(True, None, len(r_vals))
            else:
                sortino_note = SampleNote(False, "Sortino unavailable — insufficient downside variance.", len(r_vals))
        else:
            sortino_note = SampleNote(
                False,
                "Sortino unavailable — fewer than 2 losing observations.",
                len(r_vals),
            )

    sample_note = None
    if n < MIN_INSIGHT_N:
        sample_note = f"Sample size is {n}. Treat these figures as descriptive, not conclusive."

    return PerformanceMetrics(
        n_trades=n,
        n_wins=len(wins),
        n_losses=len(losses),
        n_be=len(bes),
        win_rate=win_rate,
        net_pnl=net,
        gross_profit=gp,
        gross_loss=gl,
        average_win=avg_win,
        average_loss=avg_loss,
        expectancy_r=exp_r,
        expectancy_currency=exp_ccy,
        profit_factor=profit_factor,
        average_r=avg_r,
        average_win_r=ratio(_mean(win_r)) if win_r else None,
        average_loss_r=ratio(_mean(loss_r)) if loss_r else None,
        max_drawdown=max_dd,
        max_drawdown_pct=ratio(max_dd_pct),
        recovery_factor=recovery,
        consecutive_losses=consec_l,
        consecutive_wins=consec_w,
        max_consecutive_losses=_max_streak(results, TradeResult.LOSS),
        max_consecutive_wins=_max_streak(results, TradeResult.WIN),
        sharpe=sharpe,
        sortino=sortino,
        sharpe_note=sharpe_note,
        sortino_note=sortino_note,
        sample_note=sample_note,
    )


def group_by(
    trades: Sequence[ClosedTrade],
    key_fn,
    starting_balance: Decimal,
    insight_label: str | None = None,
) -> list[GroupStats]:
    buckets: dict[str, list[ClosedTrade]] = defaultdict(list)
    for t in _closed(trades):
        buckets[str(key_fn(t))].append(t)
    out: list[GroupStats] = []
    for key, items in sorted(buckets.items(), key=lambda kv: -len(kv[1])):
        m = compute_performance(items, starting_balance)
        insight = None
        if insight_label and m.n_trades >= MIN_INSIGHT_N and m.expectancy_r is not None:
            if m.expectancy_r < ZERO:
                insight = (
                    f"{insight_label} '{key}' has produced negative expectancy "
                    f"({m.expectancy_r}R) over {m.n_trades} trades."
                )
            elif m.expectancy_r > ZERO:
                insight = (
                    f"{insight_label} '{key}' has produced {m.expectancy_r}R expectancy "
                    f"over {m.n_trades} trades. Sample size shown; not a profitability claim."
                )
        elif m.n_trades < MIN_INSIGHT_N:
            insight = f"n={m.n_trades} — insufficient for inference."
        out.append(
            GroupStats(
                key=key,
                n=m.n_trades,
                net_pnl=m.net_pnl,
                expectancy_r=m.expectancy_r,
                win_rate=m.win_rate,
                average_r=m.average_r,
                profit_factor=m.profit_factor,
                insight=insight,
            )
        )
    return out


def rr_bucket(planned_rr: Decimal | None) -> str:
    if planned_rr is None:
        return "unknown"
    if planned_rr < Decimal("1.0"):
        return "<1.0"
    if planned_rr < Decimal("1.5"):
        return "1.0–1.5"
    if planned_rr < Decimal("2.0"):
        return "1.5–2.0"
    if planned_rr < Decimal("3.0"):
        return "2.0–3.0"
    return "3.0+"
