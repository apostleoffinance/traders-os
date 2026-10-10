"""The trade-market snapshot ORM and Alembic head must remain aligned."""

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

from app.models.market import TradeMarketSnapshot


def test_trade_market_snapshot_migration_is_current_head() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    script = ScriptDirectory.from_config(config)

    revision = script.get_revision("0016_trade_market_snapshots")
    assert revision is not None
    assert revision.down_revision == "0015_broker_candles"
    assert script.get_heads() == ["0016_trade_market_snapshots"]


def test_trade_market_snapshot_has_deduplication_constraint() -> None:
    unique_constraints = {
        frozenset(column.name for column in constraint.columns): constraint.name
        for constraint in TradeMarketSnapshot.__table__.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
    }
    assert unique_constraints[
        frozenset({"trade_id", "timeframe", "fingerprint"})
    ] == "uq_trade_market_snapshot_fingerprint"
    assert unique_constraints[
        frozenset({"trade_id", "timeframe", "version"})
    ] == "uq_trade_market_snapshot_version"
