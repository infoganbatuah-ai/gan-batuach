# DRAFT — NOT APPLIED: Event risk processing ownership

Status: **local review only; not a migration, implementation, or activation**. This
directory is deliberately outside `supabase/migrations/` and every runtime import
path. No SQL here has been run. The draft SQL starts an aborted transaction so
accidental execution cannot reach its DDL. Removing that guard requires a new,
explicit Development database authorization and review.

Baseline: `codex/event-ingest-replay-identity-20261025` at
`2b3755bf47ac875460c6ddcf7436ccad5a097440`, preserving
`ee5ee96cbc1769159605b760f1d535afaaec470c`. The separate PUSH 44 worktree,
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
The Home tenant-scope representation is unresolved: the canonical Site may
have no `digital_observer_organization_id`. The draft deliberately stores no
invented Tenant key. Resolve mapping and historical ownership before SQL is
applied; Site is the current processing partition, not proof of Tenant scope.

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
Retention: no automatic deletion is proposed; align with Event/risk retention
and legal holds after recovery review. Cost and storage growth remain unmeasured.

The eventual migration requires a separate read-only historical Site audit,
row-level and function-EXECUTE review, a tested backup/restore path, lock-duration
assessment, and exact Development-only approval. New RPCs must be server-only,
least-privilege, fail closed and unavailable to `anon`/`authenticated`. No
service-role credential may enter the Gateway or mobile client. The current
application derives risk Site from a Site-scoped Incident and rejects a
mismatched engine input; this does not replace database-level integrity.

## Review files and open gates

- `DRAFT-NOT-APPLIED.sql`: intentionally non-executable table/constraint sketch;
  **no claim or completion RPC is defined or granted**.
- `RPC-CONTRACT.md`: exact server-only claim/persist inputs, outputs and
  transaction requirements; completion remains an explicit design gate.
- `SITE-PREFLIGHT-READ-ONLY.sql`: proposed counts and pseudonymous row handles;
  **not run**.
- `TEST-AND-ROLLBACK.md`: synthetic acceptance matrix, forward recovery and
  rollback conditions; **not run**.
- `EFFECT-RECOVERY-REVIEW.md`: source-grounded effect inventory, ACK boundary
  and unresolved Home Tenant mapping; no live data assertion.
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
