# Digital Observer Resync State Machine

`SYNCHRONIZED → BACKLOG_PENDING → RESYNCHRONIZING → SYNCHRONIZED`

Failure transitions:

- missing/ambiguous ACK: `DELIVERING → FAILED → BACKOFF → PENDING`
- process/update interruption: `DELIVERING → PENDING`
- revoked identity: `* → RESYNC_BLOCKED_REVOKED`
- incompatible schema: `* → QUARANTINED / NEEDS_ATTENTION`
- storage limit: `* → DISK_PRESSURE`; critical records are not silently removed

Cloud return invokes a bounded batch automatically. Each ordering key exposes only its oldest pending item, preserving source/track causality without globally serializing unrelated cameras. Delivery uses PUSH 18 device authentication. Explicit ACK deletes the row; timeout after cloud acceptance safely retries the same stable ID.

`LIVE` is limited to delivery delay of at most 60 seconds. Older data is `BACKFILL_RESYNC`, preserves original observation/provenance, and is prevented from automatically triggering time-sensitive external notification or Digital Guard action.
