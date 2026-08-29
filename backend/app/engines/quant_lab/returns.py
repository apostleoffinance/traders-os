"""Normalized return series for Quant Lab."""

from __future__ import annotations

from decimal import Decimal
from typing import Sequence

from app.engines.analytics_lab.trade_row import AnalyticsTrade
from app.engines.fx_math import ZERO


def currency_returns(trades: Sequence[AnalyticsTrade]) -> list[Decimal]:
    return [t.net_pnl for t in trades]


def r_returns(trades: Sequence[AnalyticsTrade]) -> list[Decimal]:
    return [t.r_multiple for t in trades if t.r_multiple is not None]
