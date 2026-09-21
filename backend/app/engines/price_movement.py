"""Instrument-aware price movement metrics.

Raw prices remain the source of truth. This module only expresses price
distances in the native unit declared by the instrument catalog.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum

from app.core.enums import Direction
from app.engines.fx_math import InstrumentSpec, ZERO, get_instrument, ratio


class MovementUnit(StrEnum):
    PIP = "PIP"
    PRICE_UNIT = "PRICE_UNIT"
    TICK = "TICK"
    POINT = "POINT"
    CURRENCY = "CURRENCY"
    PERCENT = "PERCENT"


@dataclass(frozen=True)
class MovementSpec:
    unit: MovementUnit
    label: str
    short_label: str
    increment: Decimal
    precision: int


@dataclass(frozen=True)
class PriceMovement:
    raw_difference: Decimal
    absolute: Decimal
    signed: Decimal
    unit: MovementUnit
    label: str
    short_label: str
    precision: int


def movement_spec(instrument: InstrumentSpec) -> MovementSpec:
    unit = MovementUnit(instrument.movement_unit)
    labels = {
        MovementUnit.PIP: ("pips", "p"),
        MovementUnit.PRICE_UNIT: ("price units", "pt"),
        MovementUnit.TICK: ("ticks", "t"),
        MovementUnit.POINT: ("points", "pt"),
        MovementUnit.CURRENCY: (instrument.quote_currency, instrument.quote_currency),
        MovementUnit.PERCENT: ("%", "%"),
    }
    label, short = labels[unit]
    return MovementSpec(
        unit=unit,
        label=label,
        short_label=short,
        increment=instrument.movement_increment,
        precision=instrument.movement_precision,
    )


def calculate_price_movement(
    *,
    instrument: InstrumentSpec | str,
    from_price: Decimal,
    to_price: Decimal,
    direction: Direction | str | None = None,
) -> PriceMovement:
    resolved = get_instrument(instrument) if isinstance(instrument, str) else instrument
    spec = movement_spec(resolved)
    raw = to_price - from_price
    signed_raw = raw
    if direction is not None:
        direction_value = direction.value if isinstance(direction, Direction) else str(direction).lower()
        signed_raw = raw if direction_value == Direction.LONG.value else -raw
    quant = Decimal("1").scaleb(-spec.precision)
    return PriceMovement(
        raw_difference=raw,
        absolute=(abs(raw) / spec.increment).quantize(quant),
        signed=(signed_raw / spec.increment).quantize(quant),
        unit=spec.unit,
        label=spec.label,
        short_label=spec.short_label,
        precision=spec.precision,
    )


def _movement_value(
    instrument: InstrumentSpec,
    from_price: Decimal | None,
    to_price: Decimal | None,
    direction: Direction | str | None = None,
) -> Decimal | None:
    if from_price is None or to_price is None:
        return None
    return calculate_price_movement(
        instrument=instrument,
        from_price=from_price,
        to_price=to_price,
        direction=direction,
    ).signed


def trade_movement_metrics(
    *,
    symbol: str,
    direction: Direction | str,
    entry: Decimal,
    stop_loss: Decimal | None,
    take_profit: Decimal | None,
    exit_price: Decimal | None,
    mfe_price: Decimal | None,
    mae_price: Decimal | None,
) -> dict:
    instrument = get_instrument(symbol)
    risk = _movement_value(instrument, entry, stop_loss)
    target_raw = _movement_value(instrument, entry, take_profit)
    target = abs(target_raw) if target_raw is not None else None
    realized = _movement_value(instrument, entry, exit_price, direction)
    mfe_raw = _movement_value(instrument, entry, mfe_price, direction)
    mae_raw = _movement_value(instrument, entry, mae_price, direction)
    mfe = abs(mfe_raw) if mfe_raw is not None else None
    mae = abs(mae_raw) if mae_raw is not None else None
    capture = None
    left_on_table = None
    if realized is not None and mfe is not None and mfe > ZERO and realized > ZERO:
        capture = ratio(realized / mfe * Decimal("100"))
        left_on_table = (mfe - realized).quantize(Decimal("0.1"))

    movement = movement_spec(instrument)
    return {
        "unit": movement.unit.value,
        "label": movement.label,
        "short_label": movement.short_label,
        "precision": movement.precision,
        "risk": risk,
        "target": target,
        "realized": realized,
        "mfe": mfe,
        "mae": mae,
        "capture_percent": capture,
        "left_on_table": left_on_table,
        "status": "calculated",
    }