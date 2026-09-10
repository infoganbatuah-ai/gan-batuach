# DIGITAL OBSERVER — RETENTION POLICY

Date: 2026-09-10
Contract: `observer-retention-policy-v1`

Retention is versioned and independent of the selected backend. A rule binds policy ID/version, tenant, optional Site, Evidence type, effective time, retention days and whether legal hold is supported.

Deletion order is mandatory:

`ELIGIBILITY → LEGAL-HOLD CHECK → BACKEND DELETE → CANONICAL TOMBSTONE/AUDIT`.

The canonical record is never marked deleted before backend deletion succeeds. A backend failure remains retryable and leaves the object reference intact. A legal hold returns `RETAINED / LEGAL_HOLD`; PUSH 34 provides this enforcement hook but does not implement legal case management.

QA verifies not-yet-eligible, eligible, legal hold, backend failure, retry-safe execution and final deleted/tombstone state. The Production retention worker now invokes the canonical executor for `observer-storage-v1` objects and retains a named pre-contract compatibility branch. Legal retention periods and counsel approval remain external policy work; no Production Evidence was deleted for this PUSH.

Migration between backends never deletes the source before a verified target copy becomes canonical. Old-copy deletion remains a separate policy choice and must also respect hold and retention constraints.
