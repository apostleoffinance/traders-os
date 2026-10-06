from datetime import datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from app.core.enums import TradeResult, TradeStatus
from app.services import analytics_service


def _trade(index: int, at: datetime) -> SimpleNamespace:
    return SimpleNamespace(
        id=f"trade-{index}",
        trade_timestamp=at,
        exit_timestamp=at + timedelta(minutes=15),
        symbol="EURUSD",
        session="london",
        setup_id=None,
        setup=None,
        direction="long",
        timeframe="M15",
        psychology=None,
        result=TradeResult.WIN,
        status=TradeStatus.CLOSED,
        realized_pnl=Decimal("10"),
        realized_r=Decimal("1"),
    )


def test_list_filtered_trades_returns_requested_page_and_total(monkeypatch) -> None:
    now = datetime(2026, 10, 1, 12, 0, tzinfo=ZoneInfo("UTC"))
    trades = [_trade(i, now + timedelta(minutes=i)) for i in range(3)]
    user = SimpleNamespace(id="user-id", timezone="UTC")
    account = SimpleNamespace(id="account-id")

    monkeypatch.setattr(analytics_service, "get_owned_account", lambda db, user_id, account_id: account)
    monkeypatch.setattr(analytics_service, "_trades", lambda db, user_id, account_id: trades)

    result = analytics_service.list_filtered_trades(
        db=None,
        user=user,
        account_id=account.id,
        preset="all",
        limit=1,
        offset=1,
    )

    # Results are newest-first; offset=1 selects the middle trade.
    assert [row["id"] for row in result["trades"]] == ["trade-1"]
    assert result["meta"]["total"] == 3
    assert result["meta"]["returned"] == 1


def test_list_filtered_trades_offset_past_end_returns_empty_page(monkeypatch) -> None:
    now = datetime(2026, 10, 1, 12, 0, tzinfo=ZoneInfo("UTC"))
    trades = [_trade(0, now)]
    user = SimpleNamespace(id="user-id", timezone="UTC")
    account = SimpleNamespace(id="account-id")

    monkeypatch.setattr(analytics_service, "get_owned_account", lambda db, user_id, account_id: account)
    monkeypatch.setattr(analytics_service, "_trades", lambda db, user_id, account_id: trades)

    result = analytics_service.list_filtered_trades(
        db=None,
        user=user,
        account_id=account.id,
        preset="all",
        limit=100,
        offset=100,
    )

    assert result["trades"] == []
    assert result["meta"]["total"] == 1
    assert result["meta"]["returned"] == 0


def test_list_filtered_trades_uses_stable_id_tiebreak_for_equal_timestamps(monkeypatch) -> None:
    now = datetime(2026, 10, 1, 12, 0, tzinfo=ZoneInfo("UTC"))
    # Deliberately provide reverse-ish source order to prove sorting is deterministic.
    trades = [_trade(2, now), _trade(0, now), _trade(1, now)]
    user = SimpleNamespace(id="user-id", timezone="UTC")
    account = SimpleNamespace(id="account-id")

    monkeypatch.setattr(analytics_service, "get_owned_account", lambda db, user_id, account_id: account)
    monkeypatch.setattr(analytics_service, "_trades", lambda db, user_id, account_id: trades)

    first_page = analytics_service.list_filtered_trades(
        db=None, user=user, account_id=account.id, preset="all", limit=2, offset=0
    )
    second_page = analytics_service.list_filtered_trades(
        db=None, user=user, account_id=account.id, preset="all", limit=2, offset=2
    )

    assert [row["id"] for row in first_page["trades"]] == ["trade-2", "trade-1"]
    assert [row["id"] for row in second_page["trades"]] == ["trade-0"]
    assert first_page["meta"]["total"] == 3
