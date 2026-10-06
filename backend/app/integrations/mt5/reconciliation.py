from __future__ import annotations

from collections import Counter
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.mt5_connection import Mt5Connection, Mt5ProcessedDeal, Mt5SourceDeal, Mt5SyncSnapshot
from app.models.trade import Trade

CLOSING_ENTRY_TYPES = {"OUT", "OUT_BY", "INOUT"}
ECONOMIC_FIELDS = ("volume", "price", "profit", "commission", "swap")


def _decimal(value: Any) -> Decimal | None:
    if value is None:
        return None
    return value if isinstance(value, Decimal) else Decimal(str(value))


def build_reconciliation_report(db: Session, user_id: UUID, connection_id: UUID) -> dict[str, Any] | None:
    """Compare immutable broker evidence with processed closing deals and trade projections.

    This is read-only. Missing source records for old processed deals are informational because
    the source-deal ledger was introduced after MT5 syncing already existed.
    """
    connection = (
        db.query(Mt5Connection)
        .filter(Mt5Connection.id == connection_id, Mt5Connection.user_id == user_id)
        .one_or_none()
    )
    if connection is None:
        return None

    latest_snapshot = (
        db.query(Mt5SyncSnapshot)
        .filter(
            Mt5SyncSnapshot.connection_id == connection.id,
            Mt5SyncSnapshot.user_id == user_id,
            Mt5SyncSnapshot.account_id == connection.account_id,
        )
        .order_by(Mt5SyncSnapshot.received_at.desc(), Mt5SyncSnapshot.id.desc())
        .first()
    )
    source_deals = (
        db.query(Mt5SourceDeal)
        .filter(
            Mt5SourceDeal.connection_id == connection.id,
            Mt5SourceDeal.user_id == user_id,
            Mt5SourceDeal.account_id == connection.account_id,
        )
        .order_by(Mt5SourceDeal.deal_time.asc(), Mt5SourceDeal.external_deal_id.asc())
        .all()
    )
    processed_deals = (
        db.query(Mt5ProcessedDeal)
        .filter(Mt5ProcessedDeal.connection_id == connection.id)
        .order_by(Mt5ProcessedDeal.deal_id.asc())
        .all()
    )
    trades = (
        db.query(Trade)
        .filter(
            Trade.account_id == connection.account_id,
            Trade.user_id == user_id,
            Trade.external_provider == "mt5",
        )
        .order_by(Trade.trade_timestamp.asc(), Trade.id.asc())
        .all()
    )

    source_by_id = {row.external_deal_id: row for row in source_deals}
    processed_by_id = {row.deal_id: row for row in processed_deals}
    trade_by_id = {str(row.id): row for row in trades}
    trade_by_position = {row.external_position_id: row for row in trades if row.external_position_id}
    issues: list[dict[str, Any]] = []

    def issue(code: str, severity: str, message: str, **evidence: Any) -> None:
        issues.append({"code": code, "severity": severity, "message": message, **evidence})

    for source in source_deals:
        processed = processed_by_id.get(source.external_deal_id)
        if source.entry_type in CLOSING_ENTRY_TYPES and processed is None:
            issue(
                "closing_deal_not_processed",
                "error",
                "A broker closing deal exists in the source ledger but has no processed-deal record.",
                external_deal_id=source.external_deal_id,
                external_position_id=source.external_position_id,
                entry_type=source.entry_type,
            )
        if processed is None:
            continue
        for field in ECONOMIC_FIELDS:
            source_value = _decimal(getattr(source, field, None))
            processed_value = _decimal(getattr(processed, field, None))
            if source_value is not None and processed_value is not None and source_value != processed_value:
                issue(
                    "deal_economics_mismatch",
                    "error",
                    f"Broker source and processed ledger disagree on {field}.",
                    external_deal_id=source.external_deal_id,
                    field=field,
                    source_value=str(source_value),
                    processed_value=str(processed_value),
                )
        if processed.trade_id is None or str(processed.trade_id) not in trade_by_id:
            issue(
                "processed_deal_without_trade",
                "error",
                "A processed closing deal is not linked to an existing canonical trade.",
                external_deal_id=source.external_deal_id,
                trade_id=str(processed.trade_id) if processed.trade_id else None,
            )

    # This is not automatically a data-loss error: records processed before source-ledger
    # rollout cannot be backfilled from a current bounded recent_deals payload.
    for processed in processed_deals:
        if processed.deal_id not in source_by_id:
            issue(
                "processed_deal_without_source_evidence",
                "info",
                "Processed deal predates source-ledger coverage or was not present in retained source payloads.",
                external_deal_id=processed.deal_id,
            )
        if processed.trade_id is None or str(processed.trade_id) not in trade_by_id:
            if processed.deal_id not in source_by_id:
                issue(
                    "processed_deal_orphaned",
                    "error",
                    "A processed deal references no canonical trade.",
                    external_deal_id=processed.deal_id,
                    trade_id=str(processed.trade_id) if processed.trade_id else None,
                )

    latest_payload = latest_snapshot.payload if latest_snapshot else {}
    raw_positions = latest_payload.get("positions", []) if isinstance(latest_payload, dict) else []
    broker_positions = {
        str(position.get("external_position_id")): position
        for position in raw_positions
        if isinstance(position, dict) and position.get("external_position_id") is not None
    }
    for position_id, position in broker_positions.items():
        trade = trade_by_position.get(position_id)
        if trade is None:
            issue(
                "broker_position_without_trade",
                "error",
                "The latest broker snapshot contains an open position with no canonical MT5 trade.",
                external_position_id=position_id,
                symbol_raw=position.get("symbol_raw"),
            )
        elif str(getattr(trade, "status", "")).lower() == "closed":
            issue(
                "broker_position_trade_marked_closed",
                "error",
                "The broker reports this position open while its canonical trade is marked closed.",
                external_position_id=position_id,
                trade_id=str(trade.id),
            )

    for position_id, trade in trade_by_position.items():
        if str(getattr(trade, "status", "")).lower() == "open" and position_id not in broker_positions and latest_snapshot:
            issue(
                "open_trade_missing_from_latest_snapshot",
                "warning",
                "The canonical trade is open but absent from the latest broker position snapshot; a missed close deal or timing gap may explain this.",
                external_position_id=position_id,
                trade_id=str(trade.id),
                snapshot_received_at=latest_snapshot.received_at.isoformat() if latest_snapshot.received_at else None,
            )

    severity_counts = Counter(row["severity"] for row in issues)
    source_closing_count = sum(1 for row in source_deals if row.entry_type in CLOSING_ENTRY_TYPES)
    return {
        "connection_id": str(connection.id),
        "account_id": str(connection.account_id),
        "generated_at": None,
        "latest_snapshot": {
            "id": str(latest_snapshot.id),
            "received_at": latest_snapshot.received_at.isoformat() if latest_snapshot.received_at else None,
            "sync_timestamp": latest_snapshot.sync_timestamp.isoformat() if latest_snapshot.sync_timestamp else None,
            "positions_count": latest_snapshot.positions_count,
            "deals_count": latest_snapshot.deals_count,
        } if latest_snapshot else None,
        "coverage": {
            "source_deal_rows": len(source_deals),
            "source_closing_deals": source_closing_count,
            "processed_deals": len(processed_deals),
            "canonical_mt5_trades": len(trades),
            "broker_open_positions_in_latest_snapshot": len(broker_positions),
            "historical_source_coverage": "Source-deal ledger coverage begins when this feature was deployed; older processed deals may not have retained source rows.",
        },
        "summary": {
            "status": "issues_found" if any(row["severity"] in {"error", "warning"} for row in issues) else "consistent",
            "issue_count": len(issues),
            "error_count": severity_counts["error"],
            "warning_count": severity_counts["warning"],
            "info_count": severity_counts["info"],
        },
        "issues": issues,
    }
