from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.mt5_connection import Mt5Connection, Mt5SourceDeal, Mt5SyncSnapshot
from app.models.trade import Trade

LIFECYCLE_SNAPSHOT_LIMIT = 100


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _event_time(value: str | None) -> datetime:
    if not value:
        return datetime.min
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.replace(tzinfo=None)
    except (TypeError, ValueError):
        return datetime.min


def build_position_lifecycle(
    db: Session,
    user_id: UUID,
    connection_id: UUID,
    position_id: str | None = None,
) -> dict[str, Any] | None:
    """Build an evidence timeline; snapshot absence is an observation, never a close event."""
    connection = (
        db.query(Mt5Connection)
        .filter(Mt5Connection.id == connection_id, Mt5Connection.user_id == user_id)
        .one_or_none()
    )
    if connection is None:
        return None

    source_query = db.query(Mt5SourceDeal).filter(
        Mt5SourceDeal.connection_id == connection.id,
        Mt5SourceDeal.user_id == user_id,
        Mt5SourceDeal.account_id == connection.account_id,
    )
    if position_id is not None:
        source_query = source_query.filter(Mt5SourceDeal.external_position_id == position_id)
    source_deals = source_query.order_by(Mt5SourceDeal.deal_time.asc(), Mt5SourceDeal.external_deal_id.asc()).all()

    snapshots = (
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
        .limit(LIFECYCLE_SNAPSHOT_LIMIT)
        .all()
    )
    # Bound the scan to the newest snapshots, then present them chronologically.
    snapshots.sort(key=lambda row: (
        row.received_at.isoformat() if row.received_at else "",
        row.sync_timestamp.isoformat() if row.sync_timestamp else "",
        str(row.id),
    ))

    trades_query = db.query(Trade).filter(
        Trade.account_id == connection.account_id,
        Trade.user_id == user_id,
        Trade.external_provider == "mt5",
    )
    if position_id is not None:
        trades_query = trades_query.filter(Trade.external_position_id == position_id)
    trades = trades_query.order_by(Trade.trade_timestamp.asc(), Trade.id.asc()).all()
    trade_by_position = {row.external_position_id: row for row in trades if row.external_position_id}

    positions: dict[str, dict[str, Any]] = {}

    def get_position(pid: str) -> dict[str, Any]:
        return positions.setdefault(pid, {"external_position_id": pid, "events": []})

    for deal in source_deals:
        row = get_position(deal.external_position_id)
        row["events"].append({
            "event_type": "source_deal",
            "occurred_at": _iso(deal.deal_time_utc or deal.deal_time),
            "timestamp_basis": "normalized_utc" if deal.deal_time_utc else "legacy_broker_reported_time",
            "received_at": _iso(deal.received_at),
            "external_deal_id": deal.external_deal_id,
            "source_deal_row_id": str(deal.id),
            "entry_type": deal.entry_type,
            "direction": deal.direction,
            "symbol_raw": deal.symbol_raw,
            "volume": str(deal.volume),
            "price": str(deal.price),
            "profit": str(deal.profit),
            "commission": str(deal.commission),
            "swap": str(deal.swap),
            "evidence": "first_seen_source_ledger",
        })

    snapshot_position_ids: set[str] = set()
    parsed_snapshots: list[tuple[Any, dict[str, dict[str, Any]]]] = []
    for snapshot in snapshots:
        payload = snapshot.payload if isinstance(snapshot.payload, dict) else {}
        raw_positions = payload.get("positions", [])
        if not isinstance(raw_positions, list):
            raw_positions = []
        observed: dict[str, dict[str, Any]] = {}
        for raw in raw_positions:
            if not isinstance(raw, dict) or raw.get("external_position_id") is None:
                continue
            pid = str(raw["external_position_id"])
            observed[pid] = raw
            snapshot_position_ids.add(pid)
        parsed_snapshots.append((snapshot, observed))

    all_position_ids = set(positions) | snapshot_position_ids
    if position_id is not None:
        all_position_ids &= {position_id}
    for pid in all_position_ids:
        get_position(pid)

    # Record presence and absence observations, but never infer closure from absence alone.
    for snapshot, observed in parsed_snapshots:
        for pid in all_position_ids:
            raw = observed.get(pid)
            event = {
                "event_type": "snapshot_position_observation",
                "occurred_at": _iso(snapshot.sync_timestamp_utc or snapshot.sync_timestamp),
                "timestamp_basis": "normalized_utc" if snapshot.sync_timestamp_utc else "legacy_broker_reported_time",
                "received_at": _iso(snapshot.received_at),
                "snapshot_id": str(snapshot.id),
                "state": "present" if raw is not None else "absent",
                "evidence": "successful_sync_snapshot",
            }
            if raw is not None:
                event["position"] = {
                    key: raw.get(key)
                    for key in (
                        "symbol_raw", "direction", "volume", "entry_price", "current_price",
                        "stop_loss", "take_profit", "opened_at", "unrealized_pnl", "swap", "commission",
                    )
                    if key in raw
                }
            get_position(pid)["events"].append(event)

    for pid, row in positions.items():
        trade = trade_by_position.get(pid)
        row["canonical_trade"] = ({
            "trade_id": str(trade.id),
            "status": str(getattr(trade, "status", "")),
            "symbol": getattr(trade, "symbol", None),
            "opened_at": _iso(getattr(trade, "trade_timestamp", None)),
            "closed_at": _iso(getattr(trade, "closed_at", None)),
            "lot_size": str(getattr(trade, "lot_size", "")) if getattr(trade, "lot_size", None) is not None else None,
            "realized_pnl": str(getattr(trade, "realized_pnl", "")) if getattr(trade, "realized_pnl", None) is not None else None,
        } if trade else None)
        row["events"].sort(key=lambda event: (
            _event_time(event.get("occurred_at")),
            event.get("event_type", ""),
            event.get("external_deal_id", event.get("snapshot_id", "")),
        ))

    return {
        "connection_id": str(connection.id),
        "account_id": str(connection.account_id),
        "position_filter": position_id,
        "coverage": {
            "source_deal_rows": len(source_deals),
            "snapshots_scanned": len(snapshots),
            "snapshot_scan_limit": LIFECYCLE_SNAPSHOT_LIMIT,
            "snapshot_history_complete": False,
            "caveat": "Timeline covers retained source deals and at most the newest 100 successful sync snapshots. Snapshot absence is not proof of closure; old deals or snapshots may be outside retained coverage.",
        },
        "positions": [positions[pid] for pid in sorted(positions)],
    }
