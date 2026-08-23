"""Psychology analytics.

Observations always include sample size and are withheld as 'insights'
until MIN_INSIGHT_N trades exist in that bucket.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal
from typing import Sequence

from app.core.enums import Emotion
from app.engines.fx_math import ZERO, money, ratio
from app.engines.performance_engine import MIN_INSIGHT_N, GroupStats, compute_performance
from app.engines.risk_engine import ClosedTrade


@dataclass(frozen=True)
class PsychTrade(ClosedTrade):
    emotion_before: Emotion | None = None
    emotion_during: Emotion | None = None
    emotion_after: Emotion | None = None
    fomo: int = 0
    fear: int = 0
    frustration: int = 0
    revenge_intensity: int = 0
    boredom: int = 0
    confidence: int = 0


def _dominant_emotion(t: PsychTrade) -> str:
    if t.emotion_before:
        return t.emotion_before.value
    return Emotion.NEUTRAL.value


def psychology_groups(
    trades: Sequence[PsychTrade],
    starting_balance: Decimal,
) -> list[GroupStats]:
    buckets: dict[str, list[PsychTrade]] = defaultdict(list)
    for t in trades:
        buckets[_dominant_emotion(t)].append(t)

    out: list[GroupStats] = []
    for key, items in sorted(buckets.items(), key=lambda kv: -len(kv[1])):
        m = compute_performance(items, starting_balance)
        insight = None
        if m.n_trades >= MIN_INSIGHT_N and m.expectancy_r is not None:
            if m.expectancy_r < ZERO:
                insight = (
                    f"Trades marked as {key.upper()} have produced negative expectancy "
                    f"({m.expectancy_r}R) over {m.n_trades} trades."
                )
            else:
                insight = (
                    f"Trades marked as {key.upper()} have produced {m.expectancy_r}R expectancy "
                    f"over {m.n_trades} trades. Descriptive only."
                )
        else:
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


def emotional_stability_score(trades: Sequence[PsychTrade], last_n: int = 20) -> int | None:
    """0–100. Higher is more stable. Independent of P/L."""
    window = list(trades)[-last_n:]
    if not window:
        return None
    scores: list[int] = []
    for t in window:
        s = 100
        if t.emotional:
            s -= 25
        if t.revenge:
            s -= 35
        s -= min(20, t.fomo * 2)
        s -= min(20, t.fear * 2)
        s -= min(15, t.frustration * 2)
        s -= min(15, t.revenge_intensity * 2)
        if t.emotion_before in {Emotion.FOMO, Emotion.REVENGE, Emotion.FRUSTRATED}:
            s -= 15
        if t.emotion_before in {Emotion.CALM, Emotion.NEUTRAL}:
            s += 5
        scores.append(max(0, min(100, s)))
    return int(round(sum(scores) / len(scores)))
