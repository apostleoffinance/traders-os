# MT5 Reconciliation

TraderOS exposes read-only reconciliation and lifecycle evidence for each authenticated user's MT5 connection.

## Reconciliation endpoint

`GET /api/integrations/mt5/connections/{connection_id}/reconciliation`

Requires a TraderOS access token. The connection must belong to the authenticated user. Unknown and other-user connection IDs both return `404`.

The endpoint does not repair data, mutate trades, recalculate P&L, or call the broker. It compares the persisted evidence already available in TraderOS.

## Position lifecycle endpoint

`GET /api/integrations/mt5/connections/{connection_id}/lifecycle`

Optional filter: `?position_id={broker_position_id}`.

The endpoint combines first-seen source-deal records, retained successful sync snapshots, and the canonical MT5 trade projection into a chronological evidence timeline per broker position. It is owner-scoped and read-only. Events retain broker deal IDs, source row IDs, snapshot IDs, timestamps, observed position fields, and a canonical trade reference when one exists.

Snapshot observations are explicitly marked `present` or `absent`. **Absence is not a close event.** A position may be absent because of timing, incomplete or filtered payloads, or a genuine close; the timeline does not invent a close transition without a broker deal that supports it. Repeated present observations retain the state reported in each snapshot so changes to volume, price, stop loss, take profit, or other retained fields can be inspected over time.

The endpoint scans the newest 100 successful sync snapshots and orders them chronologically for display. Source-deal records are read from the retained ledger. The response marks snapshot history as incomplete and explains that events may fall outside retained coverage. It does not claim to reconstruct a complete historical broker lifecycle.

## Evidence compared

- **Source-deal ledger** — first-seen broker deal records, including opening deals and original validated payloads.
- **Processed-deal ledger** — closing deals consumed by the current MT5 trade lifecycle, with volume, price, profit, commission, swap, and a trade reference.
- **Canonical MT5 trades** — normalized journal projections, scoped to the connection's account and owner.
- **Latest successful sync snapshot** — the most recent positions list and its metadata.
- **Lifecycle observations** — source deal facts and per-snapshot position presence/state observations.

Heartbeats are not sync snapshots and are excluded from these comparisons.

## Finding severities

| Severity | Meaning |
| --- | --- |
| Error | Evidence contradicts the expected ingestion/projection lifecycle and should be investigated. |
| Warning | A state mismatch may be caused by a missed close deal, timing gap, or incomplete snapshot; investigate before changing data. |
| Info | Useful context that is not by itself proof of a current defect. |

### Finding codes

- `closing_deal_not_processed`: a source `OUT`, `OUT_BY`, or `INOUT` deal has no processed-deal row.
- `deal_economics_mismatch`: a source deal and its processed row disagree on volume, price, profit, commission, or swap.
- `trade_economics_mismatch`: a canonical trade's realized P&L, commission, or swap differs from the sum of its linked processed closing deals. This covers partial-close aggregation as well as fully closed trades.
- `closed_volume_mismatch`: a closed trade's processed closing volume differs from its opening volume. This is a warning, and is skipped when the position has an `INOUT` source deal because reversals are not simple closes.
- `inout_reversal_requires_review`: an MT5 `INOUT` deal may close one side and open reverse exposure in the same event. The current one-trade-per-position projection may not represent both lifecycles separately; inspect the source deal and lifecycle timeline.
- `processed_deal_without_trade`: a processed deal does not reference an existing canonical trade.
- `processed_deal_orphaned`: a processed deal absent from the source ledger also has no valid canonical trade reference.
- `processed_deal_without_source_evidence`: processed history has no matching source-deal row.
- `broker_position_without_trade`: the latest broker snapshot includes a position with no canonical trade.
- `broker_position_trade_marked_closed`: the broker reports a position open but its trade projection is closed.
- `open_trade_missing_from_latest_snapshot`: a trade remains open but does not appear in the latest positions snapshot.
- `source_deal_payload_drift`: a retained snapshot reports a different economic or identity field for an immutable first-seen deal row; includes exact snapshot ID and timestamps.
- `snapshot_deal_missing_from_source_ledger`: a retained successful sync payload contains a deal ID absent from the source ledger.

Opening `IN` deals are intentionally not expected to have processed-deal rows: the processed ledger currently represents closing economics, while the source ledger retains both opening and closing broker facts.

## Coverage and interpretation

The source-deal ledger was introduced after MT5 syncing was already in use. Older processed deals may therefore have no source-deal record. These are informational rather than automatically classified as data loss; a bounded `recent_deals` payload cannot reliably reconstruct complete historical deal history.

The reconciliation report scans the newest 100 successful sync snapshots for deal provenance. Snapshot details can be retrieved through the owner-scoped snapshot evidence endpoint and opened from a finding in the UI. Drift findings link to the source-ledger row, processed-deal row when present, and canonical trade reference when present. It compares only deal IDs present in each payload; because recent_deals is a moving window, omission from a later payload is not treated as disappearance. Drift findings include exact snapshot references and field values. First-seen source rows remain immutable. Older snapshots outside the bounded scan are not assessed for drift.

The report is only as complete as the data received and retained:

- A warning about an open trade missing from the latest snapshot is not proof the trade should be closed. Check whether the EA omitted a close deal or whether the snapshot is temporarily incomplete.
- A clean report means no discrepancy was detected among the retained source ledger, processed-deal ledger, canonical trades, and latest snapshot. It does not prove the broker's complete account history was imported.
- The lifecycle timeline's `absent` observation does not establish that a position was closed. Use deal evidence and other broker history to investigate.
- The report intentionally does not compare broker balance/equity totals with derived trade P&L; balance movements may include deposits, withdrawals, credits, fees, and other account-level operations that are not represented as trades.
- No automatic repair is performed. Resolve findings by reviewing broker history and retained sync payloads, then make a separately reviewed change to the import/reconciliation logic if needed.

## Frontend

The account's **MetaTrader 5 automatic sync** panel includes a **Broker data reconciliation** section. Run the check to see severity counts, record coverage, the latest snapshot metadata, findings, and historical coverage caveats. The lifecycle endpoint is currently an API capability intended for the upcoming position timeline UI.

## Reversal caveat

MT5 `INOUT` deals are surfaced as a warning because one broker deal may represent both a closing transaction and a reverse-opening transaction. The current canonical projection is keyed to one external position ID and should not be assumed to model both resulting lifecycles independently. The finding includes source-deal, processed-deal, and canonical-trade references where available. It is diagnostic only and does not change trade state or P&L.
