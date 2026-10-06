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
IDENTITY_FIELDS = ("external_position_id", "symbol_raw", "direction", "entry_type")
SNAPSHOT_SCAN_LIMIT = 100


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
        .order_by(
            Mt5SyncSnapshot.received_at.desc(),
            Mt5SyncSnapshot.sync_timestamp.desc(),
            Mt5SyncSnapshot.id.desc(),
        )
        .first()
    )
    # Bounded provenance scan; recent_deals is a moving window, not complete history.
    recent_snapshots = (
        db.query(Mt5SyncSnapshot)
        .filter(
            Mt5SyncSnapshot.connection_id == connection.id,
            Mt5SyncSnapshot.user_id == user_id,
            Mt5SyncSnapshot.account_id == connection.account_id,
        )
        .order_by(
            Mt5SyncSnapshot.received_at.desc(),
            Mt5SyncSnapshot.sync_timestamp.desc(),
            Mt5SyncSnapshot.id.desc(),
        )
        .limit(SNAPSHOT_SCAN_LIMIT)
        .all()
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

    # Compare deal facts only when an ID is present in a snapshot. Absence from a later
    # recent_deals window is not evidence that a broker deal disappeared.
    observed_snapshot_deal_ids: set[str] = set()
    for snapshot in reversed(recent_snapshots):
        payload = snapshot.payload if isinstance(snapshot.payload, dict) else {}
        raw_deals = payload.get("recent_deals", [])
        if not isinstance(raw_deals, list):
            continue
        seen_in_snapshot: set[str] = set()
        for raw_deal in raw_deals:
            if not isinstance(raw_deal, dict) or raw_deal.get("external_deal_id") is None:
                continue
            deal_id = str(raw_deal["external_deal_id"])
            if deal_id in seen_in_snapshot:
                continue
            seen_in_snapshot.add(deal_id)
            observed_snapshot_deal_ids.add(deal_id)
            source = source_by_id.get(deal_id)
            evidence = {
                "external_deal_id": deal_id,
                "snapshot_id": str(snapshot.id),
                "snapshot_received_at": snapshot.received_at.isoformat() if snapshot.received_at else None,
                "snapshot_sync_timestamp": snapshot.sync_timestamp.isoformat() if snapshot.sync_timestamp else None,
            }
            if source is None:
                issue("snapshot_deal_missing_from_source_ledger", "warning",
                      "A retained successful sync payload contains a deal ID absent from the first-seen source ledger.",
                      **evidence)
                continue
            for field in (*ECONOMIC_FIELDS, *IDENTITY_FIELDS):
                source_value = getattr(source, field, None)
                snapshot_value = raw_deal.get(field)
                if field in ECONOMIC_FIELDS:
                    left, right = _decimal(source_value), _decimal(snapshot_value)
                    differs = left is not None and right is not None and left != right
                    left_text = str(left) if left is not None else None
                    right_text = str(right) if right is not None else None
                else:
                    left_text = str(source_value) if source_value is not None else None
                    right_text = str(snapshot_value) if snapshot_value is not None else None
                    differs = left_text is not None and right_text is not None and left_text != right_text
                if differs:
                    issue("source_deal_payload_drift", "warning",
                          "A repeated broker snapshot reports a different value for a deal whose first-seen source record is immutable.",
                          **evidence, field=field, source_value=left_text,
                          snapshot_value=right_text)

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

    # Reconcile per-trade aggregate economics. The source/processed comparison above
    # validates individual facts; this catches a stale or manually altered trade projection.
    processed_by_trade: dict[str, list[Mt5ProcessedDeal]] = {}
    for processed in processed_deals:
        if processed.trade_id is not None and str(processed.trade_id) in trade_by_id:
            processed_by_trade.setdefault(str(processed.trade_id), []).append(processed)

    source_entry_types_by_position: dict[str, set[str]] = {}
    for source in source_deals:
        source_entry_types_by_position.setdefault(source.external_position_id, set()).add(source.entry_type)

    tolerance = Decimal("0.00000001")
    for trade in trades:
        linked_deals = processed_by_trade.get(str(trade.id), [])
        if not linked_deals:
            continue
        expected_profit = sum((_decimal(row.profit) or Decimal("0")) for row in linked_deals)
        expected_commission = sum((_decimal(row.commission) or Decimal("0")) for row in linked_deals)
        expected_swap = sum((_decimal(row.swap) or Decimal("0")) for row in linked_deals)
        expected_net = expected_profit + expected_commission + expected_swap
        aggregate_values = (
            ("realized_pnl", _decimal(trade.realized_pnl), expected_net),
            ("commission", _decimal(trade.commission) or Decimal("0"), expected_commission),
            ("swap", _decimal(trade.swap) or Decimal("0"), expected_swap),
        )
        for field, actual, expected in aggregate_values:
            if actual is None or abs(actual - expected) > tolerance:
                issue(
                    "trade_economics_mismatch",
                    "error",
                    f"The canonical trade's {field} does not match the sum of its processed closing deals.",
                    trade_id=str(trade.id),
                    external_position_id=trade.external_position_id,
                    field=field,
                    trade_value=str(actual) if actual is not None else None,
                    processed_deals_value=str(expected),
                    processed_deal_count=len(linked_deals),
                )

        # Volume equality is meaningful for a fully closed position made of OUT/OUT_BY
        # deals. INOUT can represent a reversal and should not be treated as a simple close.
        position_entry_types = source_entry_types_by_position.get(trade.external_position_id or "", set())
        if (
            str(getattr(trade, "status", "")).lower() == "closed"
            and "INOUT" not in position_entry_types
        ):
            closed_volume = sum((_decimal(row.volume) or Decimal("0")) for row in linked_deals)
            trade_volume = _decimal(trade.lot_size) or Decimal("0")
            if abs(closed_volume - trade_volume) > tolerance:
                issue(
                    "closed_volume_mismatch",
                    "warning",
                    "The sum of processed closing-deal volume differs from the canonical trade's opening volume.",
                    trade_id=str(trade.id),
                    external_position_id=trade.external_position_id,
                    trade_volume=str(trade_volume),
                    processed_closing_volume=str(closed_volume),
                    processed_deal_count=len(linked_deals),
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
            "snapshots_scanned": len(recent_snapshots),
            "snapshot_scan_limit": SNAPSHOT_SCAN_LIMIT,
            "snapshot_deal_ids_observed": len(observed_snapshot_deal_ids),
            "snapshot_deal_ids_missing_from_source_ledger": len(observed_snapshot_deal_ids - set(source_by_id)),
            "newest_scanned_snapshot_received_at": recent_snapshots[0].received_at.isoformat()
                if recent_snapshots and recent_snapshots[0].received_at else None,
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
