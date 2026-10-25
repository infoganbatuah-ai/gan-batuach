# DRAFT — server-only claim and completion contracts

These are review signatures and transaction requirements, **not deployed
RPCs**. No route calls them. Three abort-guarded offline bodies now exist in
`RPC-BODIES-NOT-APPLIED.sql`; four downstream bodies remain BLOCKED. A future
migration must define reviewed exact SQL, revoke
default `PUBLIC` function execution within the same transaction, grant only the
reviewed server role, and prove Data API exposure is limited. Never put the
service credential in a Gateway, browser or mobile build.

## `claim_event_risk_v1(signal_id, engine_version, owner_nonce, lease_seconds)`

Inputs are server-generated except the already-persisted canonical signal ID.
`owner_nonce` must be unpredictable and unique per processing attempt.
`lease_seconds` is bounded by server policy; the endpoint may not lengthen it
without review. This RPC must:

1. Load and lock the signal, its canonical Incident link and Incident. Verify
   `REAL_CAMERA_AI`, `validated_event`, supported entry/exit event type, exact
   Site match and an active eligible processing context. An unmatched exit
   returns `NOT_APPLICABLE`; a mismatched link fails closed. Derive Site from
   canonical rows, never caller arguments. Model A proposes the existing
   `digital_observer_organizations.id` as Tenant, but Home ownership and
   historical Site mapping are unverified. Never substitute owner profile,
   enrollment's nullable tenant claim, or billing account key.
2. Atomically insert a claim or take over an expired claim by incrementing
   `owner_epoch`. Do not replace a live owner. The primary key is `(signal_id,
   engine_version)`. A completed claim cannot be reopened for the same version.
3. Return `OWNED`, `BUSY`, `RESUME_EFFECTS`, `COMPLETED` or `NOT_APPLICABLE`.
   Only `OWNED` authorizes calculation. `RESUME_EFFECTS` carries the newly
   acquired or renewed epoch and stored evaluation ID; it authorizes fenced
   downstream recovery only, never recalculation. A different live owner
   receives `BUSY` even when risk is already persisted.

Two concurrent callers must not both receive `OWNED` for the same live lease.
Expired takeover must not erase `risk_evaluation_id`. Fail closed on missing
Site/tenant mapping or database errors. The existing generic control Lease
does not provide this domain-specific completion contract.

## `persist_event_risk_v1(signal_id, engine_version, owner_nonce, owner_epoch, result)`

One PostgreSQL transaction must lock the claim, verify exact owner nonce,
epoch, live deadline, canonical Site/Incident/Event association and result
version, then insert the immutable risk evaluation and change claim state to
`RISK_PERSISTED`. If the unique evaluation already exists, verify its Site,
Incident, Event, version and 64-character input fingerprint before returning
its ID; never accept a conflicting result as a successful replay. A stale
owner must fail without writing. If the transaction aborts, neither result
nor state transition may remain.

The result is computed by the existing deterministic risk engine. This RPC
must not become an alternative risk engine or accept arbitrary browser input.
The exact result-field validation and privilege boundary are open for security
review; the guarded SQL sketch does not create this function.

## `complete_event_risk_v1(...)` — BLOCKED DESIGN GATE

The current risk service persists watch-rule evaluations, Incident risk
projection, verification, decision intent and Incident verification projection
in separate requests; in-app notification rows are a further per-recipient
stage. The completion RPC cannot simply set `COMPLETED` after risk insertion.
A future `EFFECTS_PENDING` transition must durably freeze the decision-time
recipient/settings version, expected effect keys and semantic fingerprints
before any recoverable effect is written. Existing rows cannot be treated as
complete on `23505` without comparing their canonical contents.
A future design must choose and prove one of:

- One fenced SQL transaction for the required Incident/verification/decision
  effects, expected recipient snapshot and completion marker; or
- Durable per-stage checkpoints with idempotent replay, each fenced by the
  current epoch, followed by a completion transaction that verifies every
  required stage. Recipient/outbox completeness must be explicit, not inferred
  from the existence of a risk row. Duplicate watch-rule, verification and
  decision rows must be checked for the expected contents, not merely caught
  as `23505`.

Until that design is reviewed, `RISK_PERSISTED` is not a Gateway success
condition. On crash, replay must resume missing effects from the stored risk
row. On lease expiry, only the new epoch may finalize. A completed replay
returns the stored result, not a new evaluation. A legitimate new Event or
engine version remains processable. `COMPLETED` covers only the reviewed
Risk/Incident pipeline; the route's media-fault audit and Digital Guard
dispatch need separate ACK/replay decisions. `writeAuditEvent` currently
swallows failures. See `EFFECT-RECOVERY-REVIEW.md`.

Error classes for future review: `SCOPE_MISMATCH`, `UNTRUSTED_EVENT`,
`LEASE_BUSY`, `LEASE_EXPIRED`, `STALE_OWNER`, `RESULT_CONFLICT`,
`DOWNSTREAM_INCOMPLETE`, `DATABASE_UNAVAILABLE`. No error may trigger a
silent fallback to the old unfenced path. Neither a lease nor a unique index
alone promises physically exactly-once CPU work after a crash.

The complete proposed seven-function signature list and source/effective
permission distinction are in `PERMISSIONS-AND-RPCS.md`. These signatures
are a review contract only: no function, grant or Data API activation exists
in a database as a result of this package.
