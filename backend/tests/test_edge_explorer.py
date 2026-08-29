"""Edge Explorer matrix and combo rankings."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.engines.analytics_views import JournalTrade
from app.engines.edge_explorer import edge_matrix, ranked_combos
from app.core.enums import TradeResult, TradeStatus


def _jt(sym: str, sess: str, setup: str, r: Decimal, disc: int = 80) -> JournalTrade:
    return JournalTrade(
        id=f"{sym}-{sess}",
        symbol=sym,
        session=sess,
        setup=setup,
        direction="long",
        timeframe="M15",
        result=TradeResult.WIN if r > 0 else TradeResult.LOSS,
        status=TradeStatus.CLOSED,
        entry_at=datetime(2026, 3, 1, 9, tzinfo=timezone.utc),
        exit_at=datetime(2026, 3, 1, 11, tzinfo=timezone.utc),
        risk_amount=Decimal("10"),
        risk_percent=Decimal("1"),
        realized_pnl=r * Decimal("10"),
        realized_r=r,
        holding_time_seconds=7200,
        emotion_before="calm",
        discipline_score=disc,
    )


def test_edge_matrix_groups_cells():
    journal = [
        _jt("EURUSD", "london", "sweep", Decimal("1")),
        _jt("EURUSD", "london", "sweep", Decimal("0.5")),
        _jt("EURUSD", "new_york", "sweep", Decimal("-1")),
        _jt("GBPUSD", "london", "break", Decimal("0.8")),
    ]
    m = edge_matrix(journal, Decimal("1000"))
    assert "EURUSD" in m["symbols"]
    assert "london" in m["sessions"]
    eur_london = next(c for c in m["cells"] if c["symbol"] == "EURUSD" and c["session"] == "london")
    assert eur_london["n"] == 2
    assert eur_london["tone"] == "positive"


def test_ranked_combos_min_sample():
    journal = [_jt("EURUSD", "london", "sweep", Decimal("1")) for _ in range(6)]
    rows = ranked_combos(journal, Decimal("1000"), min_n=5)
    assert len(rows) == 1
    assert rows[0]["symbol"] == "EURUSD"
