from app.ai.guardrails.trading_signal_guard import contains_prohibited, find_prohibited


def test_allows_process_language() -> None:
    text = "Your personal daily loss limit is reached. Stand down. No setup = no trade."
    assert contains_prohibited(text) is False


def test_blocks_buy_eurusd() -> None:
    assert contains_prohibited("BUY EURUSD now") is True
    assert contains_prohibited("This is a buy signal") is True
    assert contains_prohibited("Enter now at market") is True


def test_blocks_nested_json() -> None:
    payload = {"summary": "Fine", "areas_to_review": ["Sell EURUSD on the next London open"]}
    assert contains_prohibited(payload) is True
    assert find_prohibited(payload)


def test_blocks_percent_sell_score() -> None:
    assert contains_prohibited("SELL 73%") is True
