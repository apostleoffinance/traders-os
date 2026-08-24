"""Pure calculator modes. Source of truth for trade parameters — no LLM math."""

from __future__ import annotations

from decimal import Decimal

from app.core.enums import Direction
from app.engines.calculator.models import CalcMode, CalculatorInput, CalculatorResult
from app.engines.fx_math import (
    UnknownSymbolError,
    distance_from_money,
    get_instrument,
    money,
    planned_metrics,
    position_size_from_risk,
    price_from_distance,
    quantize_price,
    to_pips,
    validate_side_prices,
    ZERO,
)


def _dir(raw: str) -> Direction:
    return Direction.LONG if str(raw).lower() == "long" else Direction.SHORT


def _fail(inp: CalculatorInput, *errors: str) -> CalculatorResult:
    return CalculatorResult(
        ok=False,
        mode=inp.mode.value,
        symbol=inp.symbol,
        direction=inp.direction,
        entry=inp.entry,
        errors=list(errors),
    )


def _resolve_risk(inp: CalculatorInput) -> Decimal | None:
    if inp.risk_amount is not None:
        return inp.risk_amount
    if inp.risk_percent is not None and inp.account_balance > ZERO:
        return money(inp.account_balance * inp.risk_percent / Decimal("100"))
    return None


def _fill_metrics(result: CalculatorResult, metrics: dict, *, lot: Decimal, spec) -> CalculatorResult:
    result.lot_size = lot
    result.size_unit = spec.size_unit
    result.stop_distance = metrics.get("stop_distance")  # type: ignore[assignment]
    result.tp_distance = metrics.get("tp_distance")  # type: ignore[assignment]
    result.stop_pips = metrics.get("stop_pips")  # type: ignore[assignment]
    result.tp_pips = metrics.get("tp_pips")  # type: ignore[assignment]
    result.risk_amount = metrics.get("risk_amount")  # type: ignore[assignment]
    result.reward_amount = metrics.get("planned_reward")  # type: ignore[assignment]
    result.planned_rr = metrics.get("planned_rr")  # type: ignore[assignment]
    result.risk_percent = metrics.get("risk_percent")  # type: ignore[assignment]
    return result


def calculate(inp: CalculatorInput) -> CalculatorResult:
    try:
        spec = get_instrument(inp.symbol)
    except UnknownSymbolError as exc:
        return _fail(inp, str(exc))

    if inp.entry <= ZERO:
        return _fail(inp, "Entry must be greater than zero.")
    if inp.quote_to_account_rate <= ZERO:
        return _fail(inp, "Conversion rate required.")
    if inp.account_balance < ZERO:
        return _fail(inp, "Account balance cannot be negative.")

    direction = _dir(inp.direction)
    mode = inp.mode
    if mode == CalcMode.FIXED_RISK_SL:
        mode = CalcMode.ENTRY_SL_TO_SIZE

    if mode == CalcMode.RISK_TO_LEVELS:
        return _risk_to_levels(inp, direction, spec)
    if mode == CalcMode.ENTRY_SL_TO_SIZE:
        return _entry_sl_to_size(inp, direction, spec)
    if mode == CalcMode.TRADE_ANALYSIS:
        return _trade_analysis(inp, direction, spec)
    if mode == CalcMode.TARGET_DISTANCE:
        return _target_distance(inp, direction, spec)
    return _fail(inp, f"Unknown calculation mode: {inp.mode}")


def _risk_to_levels(inp: CalculatorInput, direction: Direction, spec) -> CalculatorResult:
    if inp.lot_size is None or inp.lot_size <= ZERO:
        return _fail(inp, "Position size is required.")
    risk = _resolve_risk(inp)
    if risk is None or risk <= ZERO:
        return _fail(inp, "Risk amount (or risk %) is required.")
    if inp.reward_amount is None or inp.reward_amount <= ZERO:
        return _fail(inp, "Target reward amount is required.")

    try:
        stop_dist = distance_from_money(
            money_amount=risk,
            lot_size=inp.lot_size,
            spec=spec,
            quote_to_account_rate=inp.quote_to_account_rate,
        )
        tp_dist = distance_from_money(
            money_amount=inp.reward_amount,
            lot_size=inp.lot_size,
            spec=spec,
            quote_to_account_rate=inp.quote_to_account_rate,
        )
    except ValueError as exc:
        return _fail(inp, str(exc))

    sl = quantize_price(price_from_distance(direction=direction, entry=inp.entry, distance=stop_dist, for_stop=True), spec)
    tp = quantize_price(price_from_distance(direction=direction, entry=inp.entry, distance=tp_dist, for_stop=False), spec)
    notes = validate_side_prices(direction, inp.entry, sl, tp)
    metrics = planned_metrics(
        symbol=spec.symbol,
        direction=direction,
        entry=inp.entry,
        stop_loss=sl,
        take_profit=tp,
        lot_size=inp.lot_size,
        account_balance=inp.account_balance,
        quote_to_account_rate=inp.quote_to_account_rate,
    )
    result = CalculatorResult(
        ok=True,
        mode=CalcMode.RISK_TO_LEVELS.value,
        symbol=spec.symbol,
        direction=direction.value,
        entry=quantize_price(inp.entry, spec),
        stop_loss=sl,
        take_profit=tp,
        conversion_rate=inp.quote_to_account_rate,
        requested_risk=money(risk),
        risk_difference=money(metrics["risk_amount"] - risk) if metrics["risk_amount"] is not None else None,
        notes=notes,
    )
    return _fill_metrics(result, metrics, lot=inp.lot_size, spec=spec)


def _entry_sl_to_size(inp: CalculatorInput, direction: Direction, spec) -> CalculatorResult:
    if inp.stop_loss is None:
        return _fail(inp, "Stop loss is required.")
    risk = _resolve_risk(inp)
    if risk is None or risk <= ZERO:
        return _fail(inp, "Risk amount (or risk %) is required.")
    notes = validate_side_prices(direction, inp.entry, inp.stop_loss, inp.take_profit)
    if any("should be" in n for n in notes):
        # Still calculate but surface side notes; hard-fail only on zero distance
        pass
    try:
        sized = position_size_from_risk(
            symbol=spec.symbol,
            entry=inp.entry,
            stop_loss=inp.stop_loss,
            risk_amount=risk,
            account_balance=inp.account_balance,
            quote_to_account_rate=inp.quote_to_account_rate,
            take_profit=inp.take_profit,
            direction=direction,
        )
    except ValueError as exc:
        return _fail(inp, str(exc))

    result = CalculatorResult(
        ok=True,
        mode=CalcMode.ENTRY_SL_TO_SIZE.value,
        symbol=spec.symbol,
        direction=direction.value,
        entry=quantize_price(inp.entry, spec),
        stop_loss=quantize_price(inp.stop_loss, spec),
        take_profit=quantize_price(inp.take_profit, spec) if inp.take_profit is not None else None,
        conversion_rate=inp.quote_to_account_rate,
        requested_risk=sized.get("requested_risk"),  # type: ignore[arg-type]
        risk_difference=sized.get("risk_difference"),  # type: ignore[arg-type]
        notes=notes,
    )
    return _fill_metrics(result, sized, lot=sized["lot_size"], spec=spec)


def _trade_analysis(inp: CalculatorInput, direction: Direction, spec) -> CalculatorResult:
    if inp.stop_loss is None:
        return _fail(inp, "Stop loss is required.")
    if inp.lot_size is None or inp.lot_size <= ZERO:
        return _fail(inp, "Position size is required.")
    notes = validate_side_prices(direction, inp.entry, inp.stop_loss, inp.take_profit)
    metrics = planned_metrics(
        symbol=spec.symbol,
        direction=direction,
        entry=inp.entry,
        stop_loss=inp.stop_loss,
        take_profit=inp.take_profit,
        lot_size=inp.lot_size,
        account_balance=inp.account_balance,
        quote_to_account_rate=inp.quote_to_account_rate,
    )
    result = CalculatorResult(
        ok=True,
        mode=CalcMode.TRADE_ANALYSIS.value,
        symbol=spec.symbol,
        direction=direction.value,
        entry=quantize_price(inp.entry, spec),
        stop_loss=quantize_price(inp.stop_loss, spec),
        take_profit=quantize_price(inp.take_profit, spec) if inp.take_profit is not None else None,
        conversion_rate=inp.quote_to_account_rate,
        notes=notes,
    )
    return _fill_metrics(result, metrics, lot=inp.lot_size, spec=spec)


def _target_distance(inp: CalculatorInput, direction: Direction, spec) -> CalculatorResult:
    if inp.lot_size is None or inp.lot_size <= ZERO:
        return _fail(inp, "Position size is required.")
    if inp.reward_amount is None or inp.reward_amount <= ZERO:
        return _fail(inp, "Target profit amount is required.")
    try:
        tp_dist = distance_from_money(
            money_amount=inp.reward_amount,
            lot_size=inp.lot_size,
            spec=spec,
            quote_to_account_rate=inp.quote_to_account_rate,
        )
    except ValueError as exc:
        return _fail(inp, str(exc))
    tp = quantize_price(price_from_distance(direction=direction, entry=inp.entry, distance=tp_dist, for_stop=False), spec)
    notes: list[str] = []
    metrics: dict = {
        "stop_distance": None,
        "tp_distance": tp_dist,
        "stop_pips": None,
        "tp_pips": to_pips(tp_dist, spec),
        "risk_amount": None,
        "planned_reward": money(inp.reward_amount),
        "planned_rr": None,
        "risk_percent": ZERO,
    }
    if inp.stop_loss is not None:
        notes = validate_side_prices(direction, inp.entry, inp.stop_loss, tp)
        metrics = planned_metrics(
            symbol=spec.symbol,
            direction=direction,
            entry=inp.entry,
            stop_loss=inp.stop_loss,
            take_profit=tp,
            lot_size=inp.lot_size,
            account_balance=inp.account_balance,
            quote_to_account_rate=inp.quote_to_account_rate,
        )
    result = CalculatorResult(
        ok=True,
        mode=CalcMode.TARGET_DISTANCE.value,
        symbol=spec.symbol,
        direction=direction.value,
        entry=quantize_price(inp.entry, spec),
        stop_loss=quantize_price(inp.stop_loss, spec) if inp.stop_loss is not None else None,
        take_profit=tp,
        conversion_rate=inp.quote_to_account_rate,
        notes=notes,
    )
    return _fill_metrics(result, metrics, lot=inp.lot_size, spec=spec)
