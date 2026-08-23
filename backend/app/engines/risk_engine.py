"""Account-level and trade-level risk metrics.

Personal limits are always treated as stricter than firm limits. The engine
never recommends trading through a firm constraint.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Sequence
from zoneinfo import ZoneInfo

from app.core.enums import RiskEventType, RiskStatus, TradeResult, TradeStatus
from app.core.time import as_utc
from app.engines.fx_math import ZERO, money, ratio

APPROACHING_RATIO = Decimal("0.70")
N_RISK_LOOKBACK = 5
CONSECUTIVE_LOSS_YELLOW = 3
CONSECUTIVE_LOSS_RED = 5
ESCALATION_YELLOW = Decimal("0.20")  # 20% above configured unit
ESCALATION_RED = Decimal("0.50")


@dataclass(frozen=True)
class ClosedTrade:
    id: str
    entry_at: datetime
    exit_at: datetime | None
    risk_amount: Decimal
    realized_pnl: Decimal
    result: TradeResult
    status: TradeStatus
    revenge: bool = False
    emotional: bool = False
    outside_preferred_session: bool = False


@dataclass(frozen=True)
class RiskProfileView:
    risk_per_trade: Decimal
    personal_daily_loss_limit: Decimal
    personal_max_drawdown: Decimal
    firm_daily_drawdown_limit: Decimal
    firm_max_drawdown_limit: Decimal
    max_trades_per_day: int
    preferred_min_rr: Decimal
    hard_risk_per_trade: Decimal | None = None
    consecutive_loss_halt: int = 5
    daily_loss_approaching_ratio: Decimal = APPROACHING_RATIO


@dataclass
class RiskEventDraft:
    event_type: RiskEventType
    severity: RiskStatus
    message: str
    metric_value: Decimal | None = None
    threshold_value: Decimal | None = None
    trade_id: str | None = None


@dataclass
class EquityPoint:
    at: datetime
    equity: Decimal
    peak: Decimal
    drawdown: Decimal
    drawdown_pct: Decimal
    daily_pnl: Decimal
    cumulative_r: Decimal


@dataclass
class RiskSnapshot:
    starting_balance: Decimal
    current_balance: Decimal
    current_equity: Decimal
    high_water_mark: Decimal
    total_pnl: Decimal
    daily_pnl: Decimal
    daily_risk: Decimal
    current_drawdown: Decimal
    current_drawdown_pct: Decimal
    max_drawdown: Decimal
    max_drawdown_pct: Decimal
    drawdown_from_start: Decimal
    trades_today: int
    consecutive_losses: int
    consecutive_wins: int
    avg_risk_last_n: Decimal | None
    risk_escalation_pct: Decimal | None
    distance_to_personal_daily_loss: Decimal
    distance_to_firm_daily_dd: Decimal
    distance_to_personal_max_dd: Decimal
    distance_to_firm_max_dd: Decimal
    status: RiskStatus
    events: list[RiskEventDraft] = field(default_factory=list)
    equity_curve: list[EquityPoint] = field(default_factory=list)
    reasons: list[str] = field(default_factory=list)


def _local_date(ts: datetime, tz: str) -> date:
    return as_utc(ts).astimezone(ZoneInfo(tz)).date()


def build_equity_curve(
    starting_balance: Decimal,
    trades: Sequence[ClosedTrade],
) -> list[EquityPoint]:
    """Equity curve from closed trades ordered by exit time.

    Drawdown is measured from the running high-water mark of equity,
    which is the statistically standard definition. Firm/personal
    remaining-distance uses starting-balance or HWM in the snapshot
    according to the configured basis — computed separately.
    """
    closed = [
        t
        for t in trades
        if t.status == TradeStatus.CLOSED and t.exit_at is not None
    ]
    closed.sort(key=lambda t: as_utc(t.exit_at))  # type: ignore[arg-type]

    equity = starting_balance
    peak = starting_balance
    cumulative_r = ZERO
    points: list[EquityPoint] = [
        EquityPoint(
            at=closed[0].entry_at if closed else datetime.now(),
            equity=starting_balance,
            peak=peak,
            drawdown=ZERO,
            drawdown_pct=ZERO,
            daily_pnl=ZERO,
            cumulative_r=ZERO,
        )
    ]
    if not closed:
        return points

    # Replace the placeholder timestamp with a synthetic "open" point
    points[0] = EquityPoint(
        at=as_utc(closed[0].entry_at),
        equity=starting_balance,
        peak=peak,
        drawdown=ZERO,
        drawdown_pct=ZERO,
        daily_pnl=ZERO,
        cumulative_r=ZERO,
    )

    daily_pnl = ZERO
    current_day: date | None = None
    for trade in closed:
        exit_at = as_utc(trade.exit_at)  # type: ignore[arg-type]
        day = exit_at.date()
        if current_day is None or day != current_day:
            daily_pnl = ZERO
            current_day = day
        daily_pnl += trade.realized_pnl
        equity += trade.realized_pnl
        if trade.risk_amount > ZERO:
            cumulative_r += trade.realized_pnl / trade.risk_amount
        if equity > peak:
            peak = equity
        dd = peak - equity
        dd_pct = (dd / peak * Decimal("100")) if peak > ZERO else ZERO
        points.append(
            EquityPoint(
                at=exit_at,
                equity=money(equity),
                peak=money(peak),
                drawdown=money(dd),
                drawdown_pct=ratio(dd_pct),
                daily_pnl=money(daily_pnl),
                cumulative_r=ratio(cumulative_r),
            )
        )
    return points


def consecutive_results(trades: Sequence[ClosedTrade]) -> tuple[int, int]:
    """Return (consecutive_losses, consecutive_wins) from the most recent closed trade."""
    closed = [
        t for t in trades if t.status == TradeStatus.CLOSED and t.exit_at is not None
    ]
    closed.sort(key=lambda t: as_utc(t.exit_at))  # type: ignore[arg-type]
    if not closed:
        return 0, 0
    last = closed[-1]
    if last.result == TradeResult.LOSS:
        n = 0
        for t in reversed(closed):
            if t.result == TradeResult.LOSS:
                n += 1
            else:
                break
        return n, 0
    if last.result == TradeResult.WIN:
        n = 0
        for t in reversed(closed):
            if t.result == TradeResult.WIN:
                n += 1
            else:
                break
        return 0, n
    return 0, 0


def _daily_closed(
    trades: Sequence[ClosedTrade],
    on_date: date,
    tz: str,
) -> list[ClosedTrade]:
    out: list[ClosedTrade] = []
    for t in trades:
        ts = t.exit_at or t.entry_at
        if _local_date(ts, tz) == on_date and t.status == TradeStatus.CLOSED:
            out.append(t)
    return out


def compute_risk_snapshot(
    *,
    starting_balance: Decimal,
    profile: RiskProfileView,
    trades: Sequence[ClosedTrade],
    now: datetime,
    timezone: str = "Africa/Lagos",
    lookback_n: int = N_RISK_LOOKBACK,
) -> RiskSnapshot:
    curve = build_equity_curve(starting_balance, trades)
    last = curve[-1]
    equity = last.equity
    hwm = last.peak
    total_pnl = money(equity - starting_balance)
    drawdown_from_start = money(max(ZERO, starting_balance - equity))
    max_dd = money(max((p.drawdown for p in curve), default=ZERO))
    max_dd_pct = max((p.drawdown_pct for p in curve), default=ZERO)

    today = _local_date(now, timezone)
    todays = _daily_closed(trades, today, timezone)
    # also count open trades placed today toward frequency
    trades_today = 0
    for t in trades:
        if _local_date(t.entry_at, timezone) == today:
            trades_today += 1
    daily_pnl = money(sum((t.realized_pnl for t in todays), ZERO))
    daily_risk = money(sum((t.risk_amount for t in todays), ZERO))

    consec_l, consec_w = consecutive_results(trades)

    closed_ordered = [
        t for t in trades if t.status == TradeStatus.CLOSED and t.exit_at is not None
    ]
    closed_ordered.sort(key=lambda t: as_utc(t.exit_at))  # type: ignore[arg-type]
    last_n = closed_ordered[-lookback_n:] if closed_ordered else []
    avg_risk: Decimal | None = None
    escalation: Decimal | None = None
    if last_n:
        avg_risk = money(sum((t.risk_amount for t in last_n), ZERO) / Decimal(len(last_n)))
        if profile.risk_per_trade > ZERO:
            escalation = ratio((avg_risk - profile.risk_per_trade) / profile.risk_per_trade)

    # Remaining distance to limits. Daily firm DD is from today's start equity.
    # Personal daily loss is a cash-loss cap (typically from 00:00 local).
    daily_loss = money(abs(daily_pnl) if daily_pnl < ZERO else ZERO)
    dist_personal_daily = money(profile.personal_daily_loss_limit - daily_loss)
    dist_firm_daily = money(profile.firm_daily_drawdown_limit - daily_loss)
    dist_personal_max = money(profile.personal_max_drawdown - last.drawdown)
    dist_firm_max = money(profile.firm_max_drawdown_limit - last.drawdown)

    events: list[RiskEventDraft] = []
    reasons: list[str] = []

    def add(
        event_type: RiskEventType,
        severity: RiskStatus,
        message: str,
        metric: Decimal | None = None,
        threshold: Decimal | None = None,
    ) -> None:
        events.append(
            RiskEventDraft(event_type, severity, message, metric, threshold)
        )
        reasons.append(message)

    # Daily loss
    if profile.personal_daily_loss_limit > ZERO:
        if daily_loss >= profile.personal_daily_loss_limit:
            add(
                RiskEventType.DAILY_LOSS_EXCEEDED,
                RiskStatus.RED,
                (
                    f"RED — You have reached your personal daily loss limit of "
                    f"${profile.personal_daily_loss_limit}. No further trading is recommended today."
                ),
                daily_loss,
                profile.personal_daily_loss_limit,
            )
        elif daily_loss >= profile.personal_daily_loss_limit * APPROACHING_RATIO:
            add(
                RiskEventType.DAILY_LOSS_APPROACHING,
                RiskStatus.YELLOW,
                (
                    f"YELLOW — Daily loss is ${daily_loss}, "
                    f"{ratio(daily_loss / profile.personal_daily_loss_limit * 100)}% of your "
                    f"${profile.personal_daily_loss_limit} personal daily limit."
                ),
                daily_loss,
                profile.personal_daily_loss_limit,
            )

    if profile.firm_daily_drawdown_limit > ZERO and daily_loss >= profile.firm_daily_drawdown_limit:
        add(
            RiskEventType.FIRM_DAILY_DRAWDOWN_EXCEEDED,
            RiskStatus.RED,
            (
                f"RED — Daily loss ${daily_loss} has reached the firm daily drawdown limit of "
                f"${profile.firm_daily_drawdown_limit}. Stop trading. Do not violate firm rules."
            ),
            daily_loss,
            profile.firm_daily_drawdown_limit,
        )
    elif (
        profile.firm_daily_drawdown_limit > ZERO
        and daily_loss >= profile.firm_daily_drawdown_limit * APPROACHING_RATIO
    ):
        add(
            RiskEventType.FIRM_DAILY_DRAWDOWN_APPROACHING,
            RiskStatus.YELLOW,
            (
                f"YELLOW — Daily loss ${daily_loss} is approaching the firm daily drawdown "
                f"limit of ${profile.firm_daily_drawdown_limit}."
            ),
            daily_loss,
            profile.firm_daily_drawdown_limit,
        )

    # Drawdown vs personal / firm max
    if last.drawdown >= profile.personal_max_drawdown > ZERO:
        add(
            RiskEventType.PERSONAL_DRAWDOWN_EXCEEDED,
            RiskStatus.RED,
            (
                f"RED — Account drawdown ${last.drawdown} has reached your personal maximum "
                f"of ${profile.personal_max_drawdown}."
            ),
            last.drawdown,
            profile.personal_max_drawdown,
        )
    elif last.drawdown >= profile.personal_max_drawdown * APPROACHING_RATIO > ZERO:
        add(
            RiskEventType.PERSONAL_DRAWDOWN_APPROACHING,
            RiskStatus.YELLOW,
            (
                f"YELLOW — Drawdown ${last.drawdown} is "
                f"{ratio(last.drawdown / profile.personal_max_drawdown * 100)}% of your "
                f"personal ${profile.personal_max_drawdown} cap."
            ),
            last.drawdown,
            profile.personal_max_drawdown,
        )

    if last.drawdown >= profile.firm_max_drawdown_limit > ZERO:
        add(
            RiskEventType.FIRM_MAX_DRAWDOWN_EXCEEDED,
            RiskStatus.RED,
            (
                f"RED — Drawdown ${last.drawdown} has reached the firm maximum of "
                f"${profile.firm_max_drawdown_limit}. Halt trading."
            ),
            last.drawdown,
            profile.firm_max_drawdown_limit,
        )
    elif last.drawdown >= profile.firm_max_drawdown_limit * APPROACHING_RATIO > ZERO:
        add(
            RiskEventType.FIRM_MAX_DRAWDOWN_APPROACHING,
            RiskStatus.YELLOW,
            (
                f"YELLOW — Drawdown ${last.drawdown} is approaching the firm maximum of "
                f"${profile.firm_max_drawdown_limit}."
            ),
            last.drawdown,
            profile.firm_max_drawdown_limit,
        )

    if profile.max_trades_per_day and trades_today >= profile.max_trades_per_day:
        add(
            RiskEventType.MAX_TRADES_PER_DAY,
            RiskStatus.YELLOW if trades_today == profile.max_trades_per_day else RiskStatus.RED,
            (
                f"{'RED' if trades_today > profile.max_trades_per_day else 'YELLOW'} — "
                f"You have taken {trades_today} trade(s) today. "
                f"Your configured maximum is {profile.max_trades_per_day}."
            ),
            Decimal(trades_today),
            Decimal(profile.max_trades_per_day),
        )

    if consec_l >= CONSECUTIVE_LOSS_RED:
        add(
            RiskEventType.CONSECUTIVE_LOSSES,
            RiskStatus.RED,
            (
                f"RED — {consec_l} consecutive losses. Trading halt recommended. "
                f"No setup is required today."
            ),
            Decimal(consec_l),
            Decimal(CONSECUTIVE_LOSS_RED),
        )
    elif consec_l >= CONSECUTIVE_LOSS_YELLOW:
        add(
            RiskEventType.CONSECUTIVE_LOSSES,
            RiskStatus.YELLOW,
            (
                f"YELLOW — {consec_l} consecutive losses. Reduce size or stand down. "
                f"No setup = no trade."
            ),
            Decimal(consec_l),
            Decimal(CONSECUTIVE_LOSS_YELLOW),
        )

    if escalation is not None and escalation >= ESCALATION_RED:
        add(
            RiskEventType.RISK_ESCALATION,
            RiskStatus.RED,
            (
                f"RED — Average risk over the last {len(last_n)} trades is "
                f"{ratio(escalation * 100)}% above your configured ${profile.risk_per_trade} risk unit."
            ),
            avg_risk,
            profile.risk_per_trade,
        )
    elif escalation is not None and escalation >= ESCALATION_YELLOW:
        add(
            RiskEventType.RISK_ESCALATION,
            RiskStatus.YELLOW,
            (
                f"YELLOW — Your average risk over the last {len(last_n)} trades is "
                f"{ratio(escalation * 100)}% above your configured ${profile.risk_per_trade} risk unit."
            ),
            avg_risk,
            profile.risk_per_trade,
        )

    recent = closed_ordered[-3:]
    if any(t.revenge for t in recent):
        add(
            RiskEventType.REVENGE_TRADE,
            RiskStatus.RED,
            "RED — Revenge trading marked on a recent trade. Stand down until emotionally stable.",
        )

    # Frequency spike: more than max_trades in a rolling 120 minutes
    cutoff = as_utc(now) - timedelta(minutes=120)
    recent_count = sum(1 for t in trades if as_utc(t.entry_at) >= cutoff)
    if profile.max_trades_per_day and recent_count > profile.max_trades_per_day:
        add(
            RiskEventType.FREQUENCY_SPIKE,
            RiskStatus.YELLOW,
            (
                f"YELLOW — {recent_count} trades in the last 2 hours versus a daily planned "
                f"maximum of {profile.max_trades_per_day}."
            ),
            Decimal(recent_count),
            Decimal(profile.max_trades_per_day),
        )

    status = RiskStatus.GREEN
    if any(e.severity == RiskStatus.RED for e in events):
        status = RiskStatus.RED
    elif any(e.severity == RiskStatus.YELLOW for e in events):
        status = RiskStatus.YELLOW

    if status == RiskStatus.GREEN:
        reasons.append("GREEN — Risk behavior is within configured personal and firm limits.")

    return RiskSnapshot(
        starting_balance=money(starting_balance),
        current_balance=money(equity),
        current_equity=money(equity),
        high_water_mark=money(hwm),
        total_pnl=total_pnl,
        daily_pnl=daily_pnl,
        daily_risk=daily_risk,
        current_drawdown=money(last.drawdown),
        current_drawdown_pct=ratio(last.drawdown_pct),
        max_drawdown=max_dd,
        max_drawdown_pct=ratio(max_dd_pct),
        drawdown_from_start=drawdown_from_start,
        trades_today=trades_today,
        consecutive_losses=consec_l,
        consecutive_wins=consec_w,
        avg_risk_last_n=avg_risk,
        risk_escalation_pct=escalation,
        distance_to_personal_daily_loss=dist_personal_daily,
        distance_to_firm_daily_dd=dist_firm_daily,
        distance_to_personal_max_dd=dist_personal_max,
        distance_to_firm_max_dd=dist_firm_max,
        status=status,
        events=events,
        equity_curve=curve,
        reasons=reasons,
    )


def planned_risk_warning(
    planned_risk: Decimal,
    profile: RiskProfileView,
) -> RiskEventDraft | None:
    if profile.hard_risk_per_trade is not None and planned_risk > profile.hard_risk_per_trade:
        return RiskEventDraft(
            event_type=RiskEventType.RISK_PER_TRADE_HARD_BLOCK,
            severity=RiskStatus.RED,
            message=(
                f"BLOCKED — Planned risk is ${planned_risk}. "
                f"Hard personal limit is ${profile.hard_risk_per_trade} per trade."
            ),
            metric_value=planned_risk,
            threshold_value=profile.hard_risk_per_trade,
        )
    if planned_risk > profile.risk_per_trade:
        return RiskEventDraft(
            event_type=RiskEventType.RISK_PER_TRADE_EXCEEDED,
            severity=RiskStatus.YELLOW,
            message=(
                f"WARNING: Planned risk is ${planned_risk}. "
                f"Account policy allows ${profile.risk_per_trade} per trade."
            ),
            metric_value=planned_risk,
            threshold_value=profile.risk_per_trade,
        )
    return None
