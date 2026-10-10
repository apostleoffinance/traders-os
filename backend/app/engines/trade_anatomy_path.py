"""Build timed MFE/MAE and optional OHLC path series for Trade Anatomy."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Sequence

from app.core.enums import Direction
from app.core.time import as_utc
from app.engines.mfe_mae import excursions_from_extremes
from app.market_data.schemas import Candle

# Cap points sent to the client for SVG scrubbing.
MAX_SERIES_POINTS = 180


@dataclass(frozen=True)
class TimedExcursions:
    mfe_price: Decimal
    mae_price: Decimal
    mfe_at: datetime | None
    mae_at: datetime | None


def _dir(direction: str | Direction) -> str:
    return direction.value if isinstance(direction, Direction) else str(direction).lower()


def _progress(at: datetime, start: datetime, end: datetime) -> float:
    total = (end - start).total_seconds()
    if total <= 0:
        return 0.0
    return round(max(0.0, min(1.0, (at - start).total_seconds() / total)), 6)


def timed_excursions_from_candles(
    candles: Sequence[Candle],
    *,
    direction: str | Direction,
    entry: Decimal,
    mfe_price: Decimal | None = None,
    mae_price: Decimal | None = None,
) -> TimedExcursions | None:
    """
    Locate MFE/MAE prices and the first bar timestamp that touches each extreme.

    Timestamps are bar-open times (M1 precision). Never invents prices — returns
    None when candles are empty.
    """
    if not candles:
        return None

    max_high = max(c.high for c in candles)
    min_low = min(c.low for c in candles)
    derived_mfe, derived_mae = excursions_from_extremes(
        direction=direction,
        entry=entry,
        max_high=max_high,
        min_low=min_low,
    )
    mfe = mfe_price if mfe_price is not None else derived_mfe
    mae = mae_price if mae_price is not None else derived_mae

    dir_val = _dir(direction)
    mfe_at: datetime | None = None
    mae_at: datetime | None = None

    has_ts = any(getattr(c, "timestamp", None) is not None for c in candles)
    ordered = (
        sorted(candles, key=lambda x: as_utc(x.timestamp))
        if has_ts
        else list(candles)
    )

    for c in ordered:
        ts = as_utc(c.timestamp) if getattr(c, "timestamp", None) is not None else None
        if dir_val == Direction.LONG.value:
            if mfe_at is None and c.high >= mfe:
                mfe_at = ts
            if mae_at is None and c.low <= mae:
                mae_at = ts
        else:
            if mfe_at is None and c.low <= mfe:
                mfe_at = ts
            if mae_at is None and c.high >= mae:
                mae_at = ts
        if has_ts and mfe_at is not None and mae_at is not None:
            break

    return TimedExcursions(mfe_price=mfe, mae_price=mae, mfe_at=mfe_at, mae_at=mae_at)


def _downsample(candles: Sequence[Candle], max_points: int) -> list[Candle]:
    if len(candles) <= max_points:
        return list(candles)
    # Keep first/last; sample evenly through the middle.
    if max_points < 3:
        return [candles[0], candles[-1]][:max_points]
    step = (len(candles) - 1) / (max_points - 1)
    idxs = {0, len(candles) - 1}
    for i in range(1, max_points - 1):
        idxs.add(int(round(i * step)))
    return [candles[i] for i in sorted(idxs)]


def _gap_summary(candles: Sequence[Candle], *, asset_class: str) -> dict[str, Any]:
    ordered = sorted(candles, key=lambda c: as_utc(c.timestamp))
    intraday_gaps: list[dict[str, Any]] = []
    long_intervals: list[dict[str, Any]] = []
    for previous, current in zip(ordered, ordered[1:]):
        seconds = int((as_utc(current.timestamp) - as_utc(previous.timestamp)).total_seconds())
        if seconds <= 60:
            continue
        interval = {
            "from": as_utc(previous.timestamp).isoformat().replace("+00:00", "Z"),
            "to": as_utc(current.timestamp).isoformat().replace("+00:00", "Z"),
            "duration_seconds": seconds,
            "missing_m1_bars_estimate": max(1, round(seconds / 60) - 1),
        }
        # FX has scheduled closures. Long gaps are disclosed separately rather than
        # misrepresented as missing bars; crypto is treated as a 24/7 market.
        if asset_class != "crypto" and seconds > 6 * 60 * 60:
            long_intervals.append(interval)
        else:
            intraday_gaps.append(interval)
    largest = max((g["duration_seconds"] for g in intraday_gaps), default=0)
    if intraday_gaps:
        status = "gaps_detected"
    elif long_intervals:
        status = "long_intervals_present"
    else:
        status = "no_intraday_gaps_detected"
    return {
        "coverage_status": status,
        "gap_count": len(intraday_gaps),
        "largest_gap_seconds": largest,
        "gaps": intraday_gaps[:20],
        "long_intervals": long_intervals[:10],
        "gap_note": (
            "Gap counts are based on timestamp intervals between returned M1 bars, not an estimated coverage percentage. "
            "Long FX intervals may reflect scheduled market closures or unavailable data and are shown separately."
        ),
    }


def build_price_series(
    candles: Sequence[Candle],
    *,
    start: datetime,
    end: datetime,
    max_points: int = MAX_SERIES_POINTS,
    asset_class: str = "fx",
) -> dict[str, Any] | None:
    """
    OHLC close path over the hold window. Returns None when no candles.

    Each point: at (ISO), t ([0,1]), close/high/low/open as strings.
    """
    if not candles:
        return None

    start_utc = as_utc(start)
    end_utc = as_utc(end)
    ordered = sorted(candles, key=lambda c: as_utc(c.timestamp))
    sampled = _downsample(ordered, max_points)

    points: list[dict[str, Any]] = []
    for c in sampled:
        ts = as_utc(c.timestamp)
        points.append(
            {
                "at": ts.isoformat().replace("+00:00", "Z"),
                "t": _progress(ts, start_utc, end_utc),
                "open": str(c.open),
                "high": str(c.high),
                "low": str(c.low),
                "close": str(c.close),
            }
        )

    # Ensure t=0 and t=1 anchors exist for scrubbing.
    if points and points[0]["t"] > 0:
        first = ordered[0]
        points.insert(
            0,
            {
                "at": as_utc(first.timestamp).isoformat().replace("+00:00", "Z"),
                "t": 0.0,
                "open": str(first.open),
                "high": str(first.high),
                "low": str(first.low),
                "close": str(first.close),
            },
        )
    if points and points[-1]["t"] < 1:
        last = ordered[-1]
        points.append(
            {
                "at": as_utc(last.timestamp).isoformat().replace("+00:00", "Z"),
                "t": 1.0,
                "open": str(last.open),
                "high": str(last.high),
                "low": str(last.low),
                "close": str(last.close),
            },
        )

    provider = getattr(ordered[0], "provider", None) if ordered else None
    gaps = _gap_summary(ordered, asset_class=asset_class)
    return {
        "source": "m1_ohlc",
        "provider": provider,
        "timeframe": "M1",
        "window_start": start_utc.isoformat().replace("+00:00", "Z"),
        "window_end": end_utc.isoformat().replace("+00:00", "Z"),
        "first_bar_at": as_utc(ordered[0].timestamp).isoformat().replace("+00:00", "Z"),
        "last_bar_at": as_utc(ordered[-1].timestamp).isoformat().replace("+00:00", "Z"),
        "bar_count": len(ordered),
        "point_count": len(points),
        "downsampled": len(ordered) > len(sampled),
        **gaps,
        "points": points,
    }


def enrich_replay_with_candles(
    payload: dict[str, Any],
    candles: Sequence[Candle],
    *,
    direction: str,
    entry: Decimal,
    start: datetime,
    end: datetime,
    mfe_price: Decimal | None,
    mae_price: Decimal | None,
    asset_class: str = "fx",
) -> dict[str, Any]:
    """Mutate/return replay payload with timed excursions + price_series when possible."""
    timed = timed_excursions_from_candles(
        candles,
        direction=direction,
        entry=entry,
        mfe_price=mfe_price,
        mae_price=mae_price,
    )
    series = build_price_series(candles, start=start, end=end, asset_class=asset_class)

    excursions = dict(payload.get("excursions") or {})
    if timed is not None:
        if excursions.get("mfe_price") is None:
            excursions["mfe_price"] = str(timed.mfe_price)
        if excursions.get("mae_price") is None:
            excursions["mae_price"] = str(timed.mae_price)
        if timed.mfe_at is not None:
            excursions["mfe_at"] = timed.mfe_at.isoformat().replace("+00:00", "Z")
            excursions["mfe_t"] = _progress(timed.mfe_at, as_utc(start), as_utc(end))
        if timed.mae_at is not None:
            excursions["mae_at"] = timed.mae_at.isoformat().replace("+00:00", "Z")
            excursions["mae_t"] = _progress(timed.mae_at, as_utc(start), as_utc(end))
        excursions["timing_precision"] = "bar_ohlc"
    payload["excursions"] = excursions

    if series is not None:
        payload["price_series"] = series
    return payload


def bar_limit(start: datetime, end: datetime) -> int:
    minutes = max(int((as_utc(end) - as_utc(start)).total_seconds() // 60), 1)
    return min(minutes + 10, 5000)
