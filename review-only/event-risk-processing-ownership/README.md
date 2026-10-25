# DRAFT — NOT APPLIED: Event risk processing ownership

Status: **local offline proposal only; not a migration or activation**. This
directory is deliberately outside `supabase/migrations/` and every runtime import
path. No SQL here has been run. The draft SQL starts an aborted transaction so
accidental execution cannot reach its DDL. Removing that guard requires a new,
explicit Development database authorization and review.

Source baseline for the final local review increment: `codex/event-ingest-replay-identity-20261025`
at `790c6e6cb6abbaddf5c3efb041a3ca4b80e095ac`, preserving
`e867ecea669093d5692313dc7f5ef8493641dfb1`,
`d6d66e326cec732791ef56fc008d45465b234e84`,
`9c3b2dc631eec61829f04f28d75b9dd30bf2f572` and
`59f6c18822a592b5812ceac2a7ec4578a595d951`. The separate PUSH 44 worktree,
PR #248, and PR #235 are outside this change.

## Existing path and the missing guarantee

`app/api/video-gateway/cloud-events/route.ts` validates Gateway, Site and source,
derives a Site-namespaced event ID, inserts or rereads the canonical signal, then
calls `evaluateAndPersistIncidentRisk` even on an identical replay. The signal
unique index prevents duplicate event rows. The risk `(incident_id,
triggering_event_id, risk_engine_version)` unique index prevents duplicate risk
rows, but neither chooses an owner **before** calculation. The risk service then
writes watch-rule evaluations, Incident projections, verification and decision
intents in separate Data API requests. Notification delivery has its own dedupe
key. These uniqueness guards do not form one processing transaction.

The existing `observer_control_leases`/`observer_control_effects` support a
fenced control-plane effect, not atomic risk-and-downstream completion. Marking
an effect before risk persistence can lose work on crash; marking it afterward
cannot stop duplicate computation. The shared AI queue accepts inference
contracts, not canonical risk decisions. The human review queue is unrelated.
Do not repurpose any of them as an unreviewed replacement Event Engine.

Prior isolated PostgreSQL evidence (not rerun for this package): two concurrent
synthetic attempts yielded one persisted signal; same Incident/Event/engine
version yielded one risk row. A privileged synthetic insert with a risk Site
different from its Incident/Event Site was accepted and rolled back. This is a
database integrity gap, **not** proof of an ordinary-user RLS bypass. All prior
synthetic rows were verified absent.

## Proposed contract, subject to review

One claim per `(signal_id, risk_engine_version)` is the minimum durable unit.
`claim(signal_id, version, request_owner_nonce)` must derive the Incident and
Site from canonical rows; it must not trust a client-supplied Site or tenant.
Model A's proposed Tenant identifier is the existing
`digital_observer_organizations.id`, not a new parallel Tenant table or key.
Its customer cardinality and Home mapping remain unverified: the canonical
Site may have no `digital_observer_organization_id`. The guarded draft carries
that candidate ID for new claims but neither invents nor backfills historical
IDs. Resolve mapping and historical ownership before SQL is applied; Site is
the current processing partition, not proof of Tenant scope.

An atomic claim returns one of:

- `OWNED(epoch, lease_until)`: caller alone may calculate while the lease is
  valid. Each request uses a new unpredictable owner nonce.
- `BUSY(retry_after)`: another live owner exists; do not calculate or acknowledge
  the Gateway event as fully processed.
- `RESUME_EFFECTS(epoch, lease_until, evaluation_id)`: a caller that acquired
  or renewed the claim owns recovery of already-persisted risk; it must not
  recalculate. A different live owner still yields `BUSY`.
- `COMPLETED(evaluation_id)`: all reviewed Risk/Incident downstream work is
  durably complete; this is **not** a full Gateway-route ACK receipt.
- `NOT_APPLICABLE`: a valid event (for example unmatched exit) has no Incident.

On expiry, a new owner may take the claim with a strictly larger epoch. The
previous owner must be rejected at **every** persistence boundary. The risk
result and transition to `RISK_PERSISTED` must commit together. Transition to
`EFFECTS_PENDING` must atomically freeze the expected effects and recipient /
settings snapshot. Transition to
`COMPLETED` must occur only after the canonical Incident projections,
watch-rule evaluations, verification, decision intent and applicable in-app
journal/outbox requirements are satisfied durably. Their transactional or
replay-safe boundary is **not yet proven** in current code;
the draft must not be activated until that boundary and error responses are
implemented and tested. A non-owner must never calculate risk.

A lease cannot guarantee that CPU work happens physically once after a crash
or lease expiry. The intended guarantee is one active owner in a healthy
window, one accepted fenced completion, retry without event loss, and no
duplicate durable effects. A new engine version is a new processing key and
must not suppress a legitimate re-evaluation or risk escalation.

## Data and security review

Business need: recoverable ownership of canonical Event-to-Risk processing.
Data owner: Digital Observer runtime. Sensitivity: scoped operational IDs and
processing status; no media, credentials, payloads or identity secrets.
Expected volume: at most one claim per retained Event and engine version;
measure actual Event rates and version changes before approval. Query pattern:
primary-key claim/lookup, bounded expired-lease recovery, no broad polling.
Retention: **unresolved**. No duration, TTL, cleanup or indefinite-retention
policy is approved; align with separate Event/risk, recipient, evidence, audit
and legal-hold decisions after recovery review. Cost and storage growth remain unmeasured.

The eventual migration requires a separate read-only historical Site audit,
row-level and function-EXECUTE review, a tested backup/restore path, lock-duration
assessment, and exact Development-only approval. New RPCs must be server-only,
least-privilege, fail closed and unavailable to `anon`/`authenticated`. No
service-role credential may enter the Gateway or mobile client. The current
application derives risk Site from a Site-scoped Incident and rejects a
mismatched engine input; this does not replace database-level integrity.

## Review files and open gates

- `FINAL-MIGRATION-REVIEW.md`: consolidated A–L design, impact, future
  qualification and exact blocking decisions; READY FOR DESIGN REVIEW only.
- `VALIDATION-AND-HANDOFF.md`: fresh static/synthetic results and explicit
  unverified database/runtime boundaries for this local increment.
- `DRAFT-NOT-APPLIED.sql`: intentionally non-executable table/constraint sketch.
- `RPC-BODIES-NOT-APPLIED.sql`: abort-guarded acquisition, renewal and recovery
  proposals; four downstream RPC bodies remain BLOCKED.
- `SEVEN-RPC-IMPLEMENTATION.md`: exact body/blocking matrix and completion contract.
- `FOUR-WRITER-SOURCE-TRANSACTION-MAP.md`: source fields, current
  multi-request writers, proposed transaction boundaries and missing facts
  for the four still-blocked downstream RPC bodies. Its local Risk-row
  comparator is not a PostgreSQL reread or durable-write proof.
- `WATCH-RULE-ACL-NOT-APPLIED.sql` and its separate guarded rollback:
  exact-signature privilege proposal, never executed.
- `RPC-CONTRACT.md`: exact server-only claim/persist inputs, outputs and
  transaction requirements; completion remains an explicit design gate.
- `SITE-PREFLIGHT-READ-ONLY.sql`: proposed counts and pseudonymous row handles;
  **not run**.
- `TEST-AND-ROLLBACK.md`: synthetic acceptance matrix, forward recovery and
  rollback conditions; **not run**.
- `EFFECT-RECOVERY-REVIEW.md`: source-grounded effect inventory, ACK boundary
  and unresolved Home Tenant mapping; no live data assertion.
- `OBJECT-INVENTORY.json`: machine-readable existing/proposed object and RPC
  inventory; source declarations are not effective database state.
- `HOME-MAPPING.md`: proposed Model A mapping and explicit historical exceptions.
- `PERMISSIONS-AND-RPCS.md`: source-defined versus previously inspected
  effective ACL, plus exact proposed RPC signatures; application remains blocked.
- `FORWARD-AND-ROLLBACK.md`: gated migration order and non-destructive rollback
  states; no rollback rehearsal has run.
- `BLOCKING-FACTS.md`: exact evidence needed before an executable migration.
- `validate-review-package.mjs`: dependency-free static containment check;
  it is not a PostgreSQL behavior test.

Open gates: canonical Home tenant scope, exact transactional downstream
completion and route-level ACK semantics (including swallowed audit failures
and Digital Guard dispatch), historical Site exceptions, RLS/ACL review,
migration locking and cost, FK behavior during approved Event retention/deletion, PostgreSQL
concurrency/restart qualification of the *new* contract, and owner approval.
No runtime flag or claim path has been added or enabled.

Local Model A/claim transition code lives outside this review directory and
remains disabled by default. Its synthetic tests do not satisfy the future
PostgreSQL concurrency, durability or migration gates.

For Model A, a future approved migration must establish a single authoritative
Tenant relationship for each eligible Site, reconcile historical Home rows,
and enforce enrollment/source/Event/Incident/Risk Site integrity. The existing
nullable enrollment `tenant_id`, optional organization ID and commercial
account key are not interchangeable Tenant authorities. No new persistent
Tenant identifier or table is selected by this local code. Claims additionally
need atomic owner fencing, a durable effect plan/recipient snapshot, semantic
effect receipts, and Incident-wide projection compare-and-swap. Restricted
functions and Data API exposure require their own privilege review. None of
these schema or permission changes has been applied.
