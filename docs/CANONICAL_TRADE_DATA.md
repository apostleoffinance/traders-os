# Canonical Trade Data and MT5 Reconciliation

## Record boundaries

TraderOS distinguishes broker evidence from the normalized journal projection:

- `Mt5SyncSnapshot` retains successful sync payloads for audit and troubleshooting.
- `Mt5SourceDeal` stores the first-seen broker facts for each connection/deal ID. The first-seen row is immutable; later payload disagreement is reported as drift rather than silently overwriting evidence.
- `Mt5ProcessedDeal` stores the closing-deal economics applied to the normalized trade. A broker deal is processed at most once per connection.
- `Trade` is the normalized trader-facing projection. It is not a substitute for raw orders, fills, and source evidence.

## Idempotency invariants

1. Source deal identity is unique on `(connection_id, external_deal_id)`.
2. Processed deal identity is unique on `(connection_id, deal_id)`.
3. A repeated close-deal payload must not increase realized P&L or closing-deal counts a second time.
4. Opening `IN` deals are retained as source evidence but are not counted as processed closing economics.
5. Missing positions in a snapshot are observations, not proof of a close. A supported closing deal is required to close a canonical trade.
6. Reconciliation is read-only and owner-scoped. It surfaces discrepancies; it never silently repairs financial records.

## Schema alignment

Alembic revision `0007_mt5_sync` already defines `uq_mt5_processed_deals`. The ORM model must declare the same constraint so production migrations, SQLite test fixtures created with `Base.metadata.create_all()`, and local environments enforce the same identity rule.

## Verification

The MT5 sync test suite covers repeated position snapshots, duplicate closing deals, partial closes, source/processed deal reconciliation, lifecycle observations, and owner isolation. The schema constraint test asserts that both source and processed deal uniqueness are represented in ORM metadata.

## Known limitations

- Concurrent duplicate sync requests may cause one transaction to encounter a uniqueness conflict. The database must never double-count the deal; the connector can safely retry the failed request. A future ingestion queue may make this retry path more ergonomic.
- The canonical MT5 projection is currently one trade per position ID. MT5 `INOUT` reversal deals are explicitly flagged because they can combine closing and reverse-opening exposure.
- Historical records created before source-deal ledger introduction may not have full source provenance.
- Balance/equity differences caused by deposits, withdrawals, credits, or account-level fees cannot be reconciled from trade P&L alone.
