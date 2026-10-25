# Offline Model A/event-risk implementation qualification — NOT APPLIED

Baseline: local `59f6c18822a592b5812ceac2a7ec4578a595d951` on
`codex/event-ingest-replay-identity-20261025`. This is a review package, not
an ordered migration or an activation. No SQL in this task was executed.

## Seven-function implementation matrix

Exact signatures are pinned in `OBJECT-INVENTORY.json` and
`PERMISSIONS-AND-RPCS.md`. The first, second and seventh have **proposed
offline bodies** in `RPC-BODIES-NOT-APPLIED.sql`, behind an aborting guard.
They are *not deployable*: the proposed Home/customer Tenant mapping has not
been independently reconciled and the new claim schema is absent. A body
being present is not PostgreSQL qualification.

| Function | Offline body | Blocking fact and consequence |
| --- | --- | --- |
| `claim_event_risk_v1(uuid,text,uuid,integer) RETURNS jsonb` | Proposed: validates a canonical REAL_CAMERA_AI Signal, Site, camera Source, link and Incident; derives candidate Tenant; PK/row lock elects one owner; returns OWNED/BUSY/RESUME_EFFECTS/COMPLETED/NOT_APPLICABLE. | Existing `observer_sites.digital_observer_organization_id` is nullable and customer cardinality/history is unverified. A non-null reference is not authoritative historical ownership; application is BLOCKED until separately reviewed mapping and PostgreSQL concurrency tests. |
| `renew_event_risk_lease_v1(uuid,text,uuid,bigint,integer) RETURNS jsonb` | Proposed conditional UPDATE with exact nonce, epoch, live deadline, allowed status and current Site/Signal/link consistency. | Depends on a valid original claim and new table; role and lease-race behavior require isolated PostgreSQL tests. |
| `persist_event_risk_v1(uuid,text,uuid,bigint,jsonb) RETURNS uuid` | **SQL BLOCKED — no body; disconnected local transition implemented.** | The local transition rejects stale ownership and semantic-result conflicts. The existing Risk writer inserts by Data API then handles 23505 with an ID-only reread; exact immutable result JSON and transactional SQL insertion are not verified. |
| `start_event_risk_effects_v1(uuid,text,uuid,bigint,jsonb) RETURNS jsonb` | **SQL BLOCKED — no body; disconnected local transition implemented.** | The local transition freezes settings version, recipient digest and effect fingerprints. The future plan table lacks an approved complete snapshot payload/retention contract; the existing choice is mutable. |
| `record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text) RETURNS jsonb` | **SQL BLOCKED — no body; disconnected local transition implemented.** | The local transition requires matching synthetic row evidence, Incident CAS and audit evidence. A receipt cannot attest that deployed watch/verification/intent/journal/audit writers committed; exact SQL mapping is absent. |
| `complete_event_risk_v1(uuid,text,uuid,bigint) RETURNS jsonb` | **SQL BLOCKED — no body; disconnected local transition implemented.** | The local transition checks all planned evidence, receipts, audit and projection references. Current deployed writers cannot prove these PostgreSQL rows or generations; never set deployed COMPLETED from receipt count. |
| `recover_expired_event_risk_v1(uuid,text,uuid,integer) RETURNS jsonb` | Proposed wrapper rereads the existing claim, delegates to the one atomic acquisition/takeover path, preserves Risk/plan/receipts and increments epoch on expiry. | Depends on first function and a verified claim; no PostgreSQL crash/race proof yet. |

For proposed functions: owner is the future reviewed migration owner, execution
is `SECURITY INVOKER`, `search_path=pg_catalog,pg_temp` and all data objects
are schema-qualified. Runtime caller is `service_role` through a server-only
client; `anon`, `authenticated` and `PUBLIC` must have no EXECUTE. In the
deployed Development setup, postgres and supabase_admin default privileges
grant new public-function EXECUTE to API roles, so each exact-function REVOKE
must occur in the same creation transaction. The public schema is in
PostgREST's configured exposed schemas; discoverability and external reach
must be tested separately. `service_role` BYPASSRLS is not a substitute for
the in-body canonical Site/Tenant checks. No service key belongs in a client.
Prefer a non-exposed processing schema in the future if compatible with the
current server RPC transport; that compatibility and schema USAGE are not
proven. No alternative SECURITY DEFINER endpoint is proposed.

## Completion, fencing and crash contract

Processing key is `(signal_id,risk_engine_version)`. The proposed claim PK
serializes contenders; owner nonce is generated server-side, epoch starts at
one and increases on every takeover, lease is at most 300 seconds, and the
current offline body accepts only `do-risk-v1` (future versions need a
reviewed allowlist). A BUSY
caller must not calculate. Every future persistence operation must lock the
claim and condition on exact nonce+epoch+unexpired lease, then revalidate
Tenant/Site/Signal/Incident; affected Incident rows must be locked in a
consistent order. A stale worker cannot commit even if it computed earlier.
The current separate Data API writes do **not** satisfy this contract.

The proposed acquisition and takeover bodies insert a bounded immutable
audit event in the same transaction, without the owner nonce; an audit write
failure aborts ownership. Routine lease renewals do not append an audit row
per call to avoid an unbounded stream; rejected attempts require bounded
server-side security logging in a future adapter. Neither the audit trigger
nor its performance was exercised here.

The required status path is CLAIMED → RISK_PERSISTED → EFFECTS_PENDING →
COMPLETED. The Risk insert and RISK_PERSISTED marker must commit together.
The plan must freeze one decision-time settings version, sorted recipient IDs,
snapshot digest, expected effect keys and semantic fingerprints before any
recoverable effect. Mandatory keys are defined by `requiredEffectKeys` in
`event-risk-recovery.ts`: Event/Incident link, Risk, each watch-rule decision,
Incident risk projection, verification, decision intent, Incident verification
projection, recipient plan, each required in-app journal row, mandatory
decision audit, conditional media-fault audit, and Guard **eligibility**. A mandatory audit failure leaves
retry eligibility and blocks completion; best-effort telemetry cannot replace
it. Guard physical dispatch, attempts and external acknowledgment are separate
states and must never be inferred from Risk COMPLETED.

Crash after claim/before Risk: new epoch may recompute. Crash after committed
Risk: new epoch must reuse the exact persisted result after a full semantic
comparison and resume missing effects. Crash mid-effects: only missing or
identical effects may be retried. Crash after durable completion/before reply:
return the same completed reference, not a new decision. Lease expiry during
work fences the old writer. No design here promises physical exactly-once CPU
work or physical Guard action. An accepted Event remains in canonical storage
and must not be deleted to simplify recovery.

For a duplicate decision intent, 23505 alone is insufficient. Compare Tenant,
Site, Event, Incident, Risk, verification, intent type, decision, payload
version, idempotency key, recipient/settings snapshot, evidence references,
cooldown/human-review flags and external-execution-disabled state. The local
`assertEquivalentDecisionIntent` contract now checks these fields; no current
database writer uses it. A mismatch is an audited conflict, not a success or
overwrite. Incident risk and verification projection writes additionally
require `WHERE id = exact_incident AND observer_site_id = exact_site AND
generation = expected_generation AND latest_reference IS NOT DISTINCT FROM
expected_previous_reference`, then atomically increment generation by one
with the fenced claim in the same transaction. The generation columns exist
only in the guarded draft. Do not let a delayed worker overwrite a newer
projection from another Event or engine version.

## Watch-rule caller and exact ACL proposal

Repository search found one direct application call:
`risk-decision-service.ts::persistRiskEvaluation` invokes the exact RPC after
Risk insert. Its caller is `cloud-events/route.ts`, which constructs the
server-only `createAdminClient()` using `SUPABASE_SERVICE_ROLE_KEY` in
`lib/supabase/admin.ts`. No other direct application/background caller or
database-function invocation of this exact name was found in inspected
source/migrations. The migration defines the function with a leading
`auth.role() = service_role` guard and grants EXECUTE to service_role after
revoking PUBLIC. Prior deployed catalog evidence shows explicit EXECUTE also
to anon and authenticated. Source search does not prove no external caller;
runtime/caller and RLS probes remain required before a real change.

`WATCH-RULE-ACL-NOT-APPLIED.sql` and
`WATCH-RULE-ACL-ROLLBACK-NOT-APPLIED.sql` contain separate exact-signature,
guarded forward and *alternative* rollback SQL. Forward removes EXECUTE from anon and
authenticated only; it preserves postgres owner, service_role and unrelated
functions. Rollback would restore those two grants only after a reviewed
compatibility/security decision. The existing body guard makes unauthorized
effects unlikely but does not justify excess EXECUTE. No broad public-schema
or shared default-privilege change is proposed. Default ACL hardening is
**BLOCKED**: catalog evidence shows two creator roles' public-schema defaults,
and changing either would affect unrelated future functions. Per-function
REVOKE is the scoped option.

## Forward dependency and lossless rollback

Future Development-only order: pin target and independent restore → reconcile
historical customer Tenant/Site mapping → add additive schema and new-write
constraints → verify claim/fencing SQL in an isolated PostgreSQL clone →
install exact-function ACL atomically → qualify Data API and RLS → perform
synthetic concurrency/crash/semantic-conflict tests → enable a disabled-by-
default adapter under separate authorization → reconcile in-flight Events.
No step is authorized here. `FORWARD-AND-ROLLBACK.md` records the full gates.

Rollback before activation retains additive schema until dependency review.
With active claims or persisted Risk, stop new claims but keep canonical
Events, Incidents, evaluations, intent/outbox/audit and claim epoch/history;
wait for expiry and forward-reconcile or quarantine. With incomplete effects,
keep the frozen plan and receipts, never refetch mutable recipients. With
COMPLETED Risk and pending Guard eligibility, retain independent Guard state;
do not replay a physical command. Schema drop is not a default rollback.
Lossless rollback remains **BLOCKED** until a future isolated compatibility
and restore rehearsal proves old/new writer coexistence and in-flight drain.

Local tests are synthetic state-transition tests only. They do not prove
PostgreSQL locking, RLS, Data API callability, crash durability or a physical
side effect. The seven signatures are accounted for, but this package is
**NOT READY TO APPLY** and the adapter remains disabled.

## Four-write disconnected implementation receipt

`event-risk-fenced-writes.ts` adds four pure operations, without importing them
into ingestion. All share a fence over exact canonical Tenant/Site/Source/
Event/Incident/Risk scope, engine version, nonce, epoch, live lease and a
monotonic synthetic write generation. Risk persistence compares input and
semantic result fingerprints. Plan start freezes the decision-time recipient
and settings digest. Effect recording requires same-scope row evidence, a
matching receipt and Incident-wide generation/reference CAS for projection
keys. Completion checks every mandatory row/receipt and both projection
references. Decision intents compare canonical fields; an audit receipt
requires affirmative committed-audit evidence. Guard dispatch remains zero.
An identical retry is a no-op; a semantic conflict fails closed.

The focused test uses a serial transactional in-memory store: it clones state
before an operation, commits only on success, and snapshots/reloads it to
model restart. This is deliberately **not** a production store or a
PostgreSQL concurrency/crash proof. The existing live Data API writers are
unchanged. The four exact RPC signatures remain SQL BLOCKED until canonical
payload shapes, recipient snapshot schema, transactional row/effect mapping
and historical Model A ownership are independently qualified.

The additional event-time ownership reader, immutable schema-v1 recipient
snapshot and local completion-plan validator are specified in
`OWNERSHIP-SNAPSHOT-COMPLETION.md`. They narrow the forward SQL contract but
do not turn the four blocked SQL bodies into deployable functions.

## Local validation receipt

- The original 5 focused Node test groups and 5 new four-write synthetic
  groups passed (10 total), including test-store rollback, recovered missing
  effects, stale owner, snapshot and semantic duplicate-intent cases.
- The review-package containment/signature/ACL validator passed; `git diff
  --check`, JSON parsing, focused TypeScript and focused lint passed.
- Whole-repository TypeScript did **not** pass in this worktree because its
  local dependency tree lacks five `@capacitor/*` packages used by the
  unchanged `observer-mobile-runtime.tsx`; the associated implicit-any
  diagnostics are downstream of those missing module types. No package was
  installed or dependency tree changed to work around the limitation.
- PostgreSQL parsing, execution, concurrency, RLS and rollback rehearsal were
  **NOT RUN** by explicit task boundary. The SQL bodies remain proposals.
