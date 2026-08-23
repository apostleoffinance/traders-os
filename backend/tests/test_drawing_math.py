"""Drawing hit-testing uses time/price screen projections, never stored pixels."""

from __future__ import annotations

import math


def dist(ax: float, ay: float, bx: float, by: float) -> float:
    return math.hypot(ax - bx, ay - by)


def dist_to_segment(px: float, py: float, ax: float, ay: float, bx: float, by: float) -> float:
    dx, dy = bx - ax, by - ay
    length2 = dx * dx + dy * dy
    if length2 == 0:
        return dist(px, py, ax, ay)
    t = ((px - ax) * dx + (py - ay) * dy) / length2
    t = max(0.0, min(1.0, t))
    return dist(px, py, ax + t * dx, ay + t * dy)


def test_point_on_trend_segment() -> None:
    assert dist_to_segment(5, 5, 0, 0, 10, 10) < 0.01


def test_point_off_trend_segment() -> None:
    assert dist_to_segment(0, 10, 0, 0, 10, 0) == 10


def test_rectangle_contains_point() -> None:
    left, right = min(10, 40), max(10, 40)
    top, bottom = min(20, 80), max(20, 80)
    assert left <= 25 <= right and top <= 50 <= bottom
    assert not (left <= 5 <= right and top <= 50 <= bottom)
