"""Shared research-context metadata is stable across analytics surfaces."""

from types import SimpleNamespace

from app.services.research_context import build_research_context


def _row(*, status: str, exit_at: str | None, pnl: str | None, r: str | None):
    return SimpleNamespace(
        status=status,
        exit_timestamp=exit_at,
        exit_at=exit_at,
        realized_pnl=pnl,
        net_pnl=pnl,
        realized_r=r,
        r_multiple=r,
    )


def test_research_context_discloses_filters_sample_and_missing_values() -> None:
    rows = [
        _row(status="closed", exit_at="2026-09-01T10:00:00Z", pnl="12", r="1.2"),
        _row(status="closed", exit_at="2026-09-02T10:00:00Z", pnl=None, r=None),
        _row(status="open", exit_at=None, pnl=None, r=None),
    ]
    context = build_research_context(
        rows,
        timezone="Africa/Lagos",
        total_account_trades=18,
        filters={"preset": "30d", "symbol": "EURUSD", "session": None},
    )

    assert context["timezone"] == "Africa/Lagos"
    assert context["filters"] == {"preset": "30d", "symbol": "EURUSD", "session": None}
    assert context["population"] == {
        "account_trades": 18,
        "filtered_trades": 3,
        "closed_trades": 2,
        "open_or_unclosed_trades": 1,
        "closed_trades_with_pnl": 1,
        "closed_trades_missing_pnl": 1,
        "closed_trades_missing_r": 1,
    }
    assert context["sample"]["n"] == 1
    assert context["r_sample"]["n"] == 1
    assert context["sample"]["level"] == "INSUFFICIENT"
    assert any("descriptive" in note for note in context["limitations"])
    assert any("R multiple" in note for note in context["limitations"])


def test_research_context_empty_cohort_is_explicit() -> None:
    context = build_research_context(
        [],
        timezone="UTC",
        filters={"preset": "custom", "symbol": "USDJPY"},
    )
    assert context["population"]["closed_trades"] == 0
    assert context["sample"]["n"] == 0
    assert context["r_sample"]["n"] == 0
    assert context["limitations"] == ["No closed trades match the selected filters."]
