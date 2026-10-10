"""MT5 ORM constraints must match the production Alembic schema."""

from app.models.mt5_connection import Mt5ProcessedDeal, Mt5SourceDeal


def _unique_constraint_names(model) -> dict[frozenset[str], str | None]:
    return {
        frozenset(column.name for column in constraint.columns): constraint.name
        for constraint in model.__table__.constraints
        if constraint.__class__.__name__ == "UniqueConstraint"
    }


def test_processed_deal_is_unique_per_connection_and_external_deal_id() -> None:
    constraints = _unique_constraint_names(Mt5ProcessedDeal)
    assert constraints[frozenset({"connection_id", "deal_id"})] == "uq_mt5_processed_deals"


def test_source_deal_is_unique_per_connection_and_external_deal_id() -> None:
    constraints = _unique_constraint_names(Mt5SourceDeal)
    assert constraints[frozenset({"connection_id", "external_deal_id"})] == "uq_mt5_source_deal"
