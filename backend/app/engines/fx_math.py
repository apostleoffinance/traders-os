"""FX sizing, distance, P/L and R-multiple math.

Monetary values use Decimal. This module is the single source of truth for
trade-level arithmetic. API routes and the frontend must not reimplement it
for persisted results.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_FLOOR, ROUND_HALF_EVEN
from typing import Mapping

from app.core.enums import AssetClass, Direction, TradeResult, TradeStatus

MONEY_Q = Decimal("0.01")
PRICE_Q = Decimal("0.00001")
PIP_Q = Decimal("0.1")
RATIO_Q = Decimal("0.01")
PERCENT_Q = Decimal("0.0001")
ZERO = Decimal("0")
ONE = Decimal("1")


class UnknownSymbolError(ValueError):
    pass


@dataclass(frozen=True)
class InstrumentSpec:
    symbol: str
    pip_size: Decimal
    contract_size: Decimal
    quote_currency: str
    price_decimals: int
    asset_class: str = AssetClass.FX.value
    base_currency: str = ""
    tick_size: Decimal | None = None
    volume_min: Decimal = Decimal("0.01")
    volume_max: Decimal = Decimal("100")
    volume_step: Decimal = Decimal("0.01")
    volume_precision: int = 2
    size_unit: str = "lots"
    display_symbol: str | None = None


def _fx(
    symbol: str,
    pip_size: Decimal,
    contract_size: Decimal,
    quote: str,
    decimals: int,
    base: str,
    *,
    asset_class: str = AssetClass.FX.value,
    volume_min: Decimal = Decimal("0.01"),
    size_unit: str = "lots",
    display: str | None = None,
) -> InstrumentSpec:
    return InstrumentSpec(
        symbol=symbol,
        pip_size=pip_size,
        contract_size=contract_size,
        quote_currency=quote,
        price_decimals=decimals,
        asset_class=asset_class,
        base_currency=base,
        tick_size=pip_size,
        volume_min=volume_min,
        volume_max=Decimal("100") if asset_class != AssetClass.CRYPTO.value else Decimal("1000"),
        volume_step=volume_min,
        volume_precision=2 if asset_class != AssetClass.CRYPTO.value else 6,
        size_unit=size_unit,
        display_symbol=display,
    )


def normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper().replace("/", "").replace("_", "").replace("-", "")


# Quote-currency P/L is exact for XXXUSD when the account is USD.
# Non-USD-quoted pairs require a quote-to-account conversion rate.
INSTRUMENTS: Mapping[str, InstrumentSpec] = {
    "EURUSD": _fx("EURUSD", Decimal("0.0001"), Decimal("100000"), "USD", 5, "EUR"),
    "GBPUSD": _fx("GBPUSD", Decimal("0.0001"), Decimal("100000"), "USD", 5, "GBP"),
    "AUDUSD": _fx("AUDUSD", Decimal("0.0001"), Decimal("100000"), "USD", 5, "AUD"),
    "NZDUSD": _fx("NZDUSD", Decimal("0.0001"), Decimal("100000"), "USD", 5, "NZD"),
    "USDJPY": _fx("USDJPY", Decimal("0.01"), Decimal("100000"), "JPY", 3, "USD"),
    "USDCAD": _fx("USDCAD", Decimal("0.0001"), Decimal("100000"), "CAD", 5, "USD"),
    "USDCHF": _fx("USDCHF", Decimal("0.0001"), Decimal("100000"), "CHF", 5, "USD"),
    "XAUUSD": _fx(
        "XAUUSD",
        Decimal("0.01"),
        Decimal("100"),
        "USD",
        2,
        "XAU",
        asset_class=AssetClass.COMMODITY.value,
        size_unit="lots",
    ),
    "BTCUSDT": _fx(
        "BTCUSDT",
        Decimal("0.01"),
        Decimal("1"),
        "USDT",
        2,
        "BTC",
        asset_class=AssetClass.CRYPTO.value,
        volume_min=Decimal("0.000001"),
        size_unit="base",
        display="BTC/USDT",
    ),
    "ETHUSDT": _fx(
        "ETHUSDT",
        Decimal("0.01"),
        Decimal("1"),
        "USDT",
        2,
        "ETH",
        asset_class=AssetClass.CRYPTO.value,
        volume_min=Decimal("0.0001"),
        size_unit="base",
        display="ETH/USDT",
    ),
    "SOLUSDT": _fx(
        "SOLUSDT",
        Decimal("0.001"),
        Decimal("1"),
        "USDT",
        3,
        "SOL",
        asset_class=AssetClass.CRYPTO.value,
        volume_min=Decimal("0.01"),
        size_unit="base",
        display="SOL/USDT",
    ),
}


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_Q, rounding=ROUND_HALF_EVEN)


def ratio(value: Decimal) -> Decimal:
    return value.quantize(RATIO_Q, rounding=ROUND_HALF_EVEN)


def pips_q(value: Decimal) -> Decimal:
    return value.quantize(PIP_Q, rounding=ROUND_HALF_EVEN)


def get_instrument(symbol: str) -> InstrumentSpec:
    key = normalize_symbol(symbol)
    spec = INSTRUMENTS.get(key)
    if spec is None:
        raise UnknownSymbolError(
            f"Unknown symbol '{symbol}'. Add it to the instrument catalog before journaling."
        )
    return spec


def price_distance(a: Decimal, b: Decimal) -> Decimal:
    return abs(a - b)


def to_pips(distance: Decimal, spec: InstrumentSpec) -> Decimal:
    if spec.pip_size == ZERO:
        raise ValueError("pip_size cannot be zero")
    return pips_q(distance / spec.pip_size)


def direction_sign(direction: Direction) -> Decimal:
    return ONE if direction == Direction.LONG else Decimal("-1")


def validate_side_prices(
    direction: Direction,
    entry: Decimal,
    stop_loss: Decimal,
    take_profit: Decimal | None,
) -> list[str]:
    """Return human-readable validation notes; does not raise.

    Long: SL below entry, TP above entry.
    Short: SL above entry, TP below entry.
    """
    notes: list[str] = []
    if direction == Direction.LONG:
        if stop_loss >= entry:
            notes.append("Long stop-loss should be below entry.")
        if take_profit is not None and take_profit <= entry:
            notes.append("Long take-profit should be above entry.")
    else:
        if stop_loss <= entry:
            notes.append("Short stop-loss should be above entry.")
        if take_profit is not None and take_profit >= entry:
            notes.append("Short take-profit should be below entry.")
    return notes


def notional_move(
    price_move: Decimal,
    lot_size: Decimal,
    spec: InstrumentSpec,
    quote_to_account_rate: Decimal = ONE,
) -> Decimal:
    """Convert a price move into account-currency P/L.

    For EURUSD and a USD account, quote_to_account_rate is 1.
    For USDJPY, pass USDJPY rate so JPY P/L converts to USD: 1 / USDJPY.
    """
    raw = price_move * lot_size * spec.contract_size * quote_to_account_rate
    return raw


def planned_metrics(
    *,
    symbol: str,
    direction: Direction,
    entry: Decimal,
    stop_loss: Decimal,
    take_profit: Decimal | None,
    lot_size: Decimal,
    account_balance: Decimal,
    quote_to_account_rate: Decimal = ONE,
) -> dict[str, Decimal | None]:
    spec = get_instrument(symbol)
    stop_dist = price_distance(entry, stop_loss)
    tp_dist = price_distance(entry, take_profit) if take_profit is not None else None
    stop_pips = to_pips(stop_dist, spec)
    tp_pips = to_pips(tp_dist, spec) if tp_dist is not None else None

    risk_amount = money(notional_move(stop_dist, lot_size, spec, quote_to_account_rate))
    planned_reward = (
        money(notional_move(tp_dist, lot_size, spec, quote_to_account_rate))
        if tp_dist is not None
        else None
    )
    planned_rr = None
    if risk_amount > ZERO and planned_reward is not None:
        planned_rr = ratio(planned_reward / risk_amount)

    risk_percent = ZERO
    if account_balance > ZERO:
        risk_percent = (risk_amount / account_balance * Decimal("100")).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_EVEN
        )

    return {
        "stop_distance": stop_dist,
        "tp_distance": tp_dist,
        "stop_pips": stop_pips,
        "tp_pips": tp_pips,
        "risk_amount": risk_amount,
        "risk_percent": risk_percent,
        "planned_reward": planned_reward,
        "planned_rr": planned_rr,
    }


def realized_pnl(
    *,
    symbol: str,
    direction: Direction,
    entry: Decimal,
    exit_price: Decimal,
    lot_size: Decimal,
    quote_to_account_rate: Decimal = ONE,
) -> Decimal:
    spec = get_instrument(symbol)
    signed_move = (exit_price - entry) * direction_sign(direction)
    return money(notional_move(signed_move, lot_size, spec, quote_to_account_rate))


def realized_r(pnl: Decimal, risk_amount: Decimal) -> Decimal | None:
    if risk_amount <= ZERO:
        return None
    return ratio(pnl / risk_amount)


def classify_result(status: TradeStatus, pnl: Decimal | None) -> TradeResult:
    if status != TradeStatus.CLOSED or pnl is None:
        return TradeResult.OPEN
    if pnl > ZERO:
        return TradeResult.WIN
    if pnl < ZERO:
        return TradeResult.LOSS
    return TradeResult.BREAKEVEN


def holding_seconds(entry_ts, exit_ts) -> int | None:
    if entry_ts is None or exit_ts is None:
        return None
    delta = exit_ts - entry_ts
    return int(delta.total_seconds())


def quantize_size(raw: Decimal, spec: InstrumentSpec) -> Decimal:
    """Round to instrument step (half-even). Prefer quantize_size_floor for risk caps."""
    step = spec.volume_step if spec.volume_step > ZERO else Decimal("0.01")
    steps = (raw / step).quantize(Decimal("1"), rounding=ROUND_HALF_EVEN)
    sized = steps * step
    if sized < spec.volume_min:
        sized = spec.volume_min
    if sized > spec.volume_max:
        sized = spec.volume_max
    q = Decimal("1").scaleb(-spec.volume_precision)
    return sized.quantize(q, rounding=ROUND_HALF_EVEN)


def quantize_size_floor(raw: Decimal, spec: InstrumentSpec) -> Decimal:
    """Round DOWN to instrument step so sized risk does not exceed the request."""
    step = spec.volume_step if spec.volume_step > ZERO else Decimal("0.01")
    if raw <= ZERO:
        return ZERO
    steps = (raw / step).to_integral_value(rounding=ROUND_FLOOR)
    sized = steps * step
    if sized > spec.volume_max:
        sized = spec.volume_max
    if sized > ZERO and sized < spec.volume_min:
        # Below minimum step: cannot size without exceeding or using zero.
        return ZERO
    q = Decimal("1").scaleb(-spec.volume_precision)
    return sized.quantize(q, rounding=ROUND_FLOOR) if sized > ZERO else ZERO


def price_from_distance(
    *,
    direction: Direction,
    entry: Decimal,
    distance: Decimal,
    for_stop: bool,
) -> Decimal:
    """Map a positive price distance to SL or TP from entry and direction."""
    if distance < ZERO:
        raise ValueError("distance must be >= 0")
    if for_stop:
        # Long SL below entry; short SL above entry
        return entry - distance if direction == Direction.LONG else entry + distance
    # Long TP above entry; short TP below entry
    return entry + distance if direction == Direction.LONG else entry - distance


def distance_from_money(
    *,
    money_amount: Decimal,
    lot_size: Decimal,
    spec: InstrumentSpec,
    quote_to_account_rate: Decimal,
) -> Decimal:
    """Invert notional_move: account-currency amount → absolute price distance."""
    if money_amount < ZERO:
        raise ValueError("money_amount must be >= 0")
    if lot_size <= ZERO:
        raise ValueError("lot_size must be > 0")
    if quote_to_account_rate <= ZERO:
        raise ValueError("quote_to_account_rate must be > 0")
    denom = lot_size * spec.contract_size * quote_to_account_rate
    if denom <= ZERO:
        raise ValueError("Cannot derive price distance with the given size")
    return money_amount / denom


def quantize_price(price: Decimal, spec: InstrumentSpec) -> Decimal:
    q = Decimal("1").scaleb(-spec.price_decimals)
    return price.quantize(q, rounding=ROUND_HALF_EVEN)


def position_size_from_risk(
    *,
    symbol: str,
    entry: Decimal,
    stop_loss: Decimal,
    risk_amount: Decimal,
    account_balance: Decimal,
    quote_to_account_rate: Decimal | None,
    take_profit: Decimal | None = None,
    direction: Direction = Direction.LONG,
) -> dict:
    """Invert planned_metrics: given $ risk, return position size. Does not fabricate a rate.

    Size is floored to the instrument step so calculated risk does not exceed requested risk.
    """
    if quote_to_account_rate is None:
        raise ValueError("quote_to_account_rate is required")
    if quote_to_account_rate <= ZERO:
        raise ValueError("quote_to_account_rate must be > 0")
    if risk_amount <= ZERO:
        raise ValueError("risk_amount must be > 0")
    spec = get_instrument(symbol)
    stop_dist = price_distance(entry, stop_loss)
    if stop_dist <= ZERO:
        raise ValueError("Stop distance must be greater than zero")
    denom = stop_dist * spec.contract_size * quote_to_account_rate
    if denom <= ZERO:
        raise ValueError("Cannot size this instrument with the given prices")
    raw = risk_amount / denom
    lots = quantize_size_floor(raw, spec)
    if lots <= ZERO:
        raise ValueError(
            "Stop is too wide for the requested risk at this instrument's minimum size."
        )
    metrics = planned_metrics(
        symbol=symbol,
        direction=direction,
        entry=entry,
        stop_loss=stop_loss,
        take_profit=take_profit,
        lot_size=lots,
        account_balance=account_balance,
        quote_to_account_rate=quote_to_account_rate,
    )
    # Safety: if half-even money rounding still edges over, step down once.
    step = spec.volume_step if spec.volume_step > ZERO else Decimal("0.01")
    while (
        metrics["risk_amount"] is not None
        and metrics["risk_amount"] > risk_amount
        and lots > spec.volume_min
    ):
        lots = quantize_size_floor(lots - step, spec)
        if lots <= ZERO:
            break
        metrics = planned_metrics(
            symbol=symbol,
            direction=direction,
            entry=entry,
            stop_loss=stop_loss,
            take_profit=take_profit,
            lot_size=lots,
            account_balance=account_balance,
            quote_to_account_rate=quote_to_account_rate,
        )
    if lots <= ZERO or (metrics["risk_amount"] is not None and metrics["risk_amount"] > risk_amount):
        raise ValueError(
            "Cannot size within the requested risk at this instrument's minimum size."
        )
    return {
        "lot_size": lots,
        "size_unit": spec.size_unit,
        "display_symbol": spec.display_symbol or spec.symbol,
        "conversion_rate": quote_to_account_rate,
        "requested_risk": money(risk_amount),
        "risk_difference": money(metrics["risk_amount"] - risk_amount),
        **metrics,
    }
