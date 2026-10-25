# Model A / Event Risk: final local migration review — NOT APPLIED

Status: **READY FOR DESIGN REVIEW; APPLY BLOCKED**. Baseline and branch at the
start of this increment: `790c6e6cb6abbaddf5c3efb041a3ca4b80e095ac`,
`codex/event-ingest-replay-identity-20261025`. This is not a new PUSH, a
Production candidate, a database migration, a tested rollback, or an active
adapter. No database connection, SQL execution, permission change, runtime
activation, provider operation, push or PR is authorized by this package.

## A. Decision and evidence boundary

Model A has one canonical customer Tenant with Sites underneath: Tenant → Site
→ Source → Event → Incident → Risk Decision. The proposed Tenant key is
`digital_observer_organizations.id`; its historical Home/customer cardinality
is **not verified**. `observer_sites.digital_observer_organization_id` is
nullable, and a non-null organization reference alone does not establish
historical customer authority. No organization, email, profile, label or
Gateway enrollment is substituted for that missing proof.

The design choice for review is one durable, immutable processing plan per
`(signal_id, risk_engine_version)`, in the already proposed
`observer_event_risk_effect_plans` table, coupled to a separately fenced claim
and effect receipts. No existing canonical table meets that complete
contract; the seven-candidate comparison is in
`SNAPSHOT-PERSISTENCE-COMPATIBILITY.md`. This is a **proposed** storage target,
not a finding that it exists. The saved Development catalog receipt in
`OBJECT-INVENTORY.json` reports the claim/plan/receipt tables, two Incident
generation columns and seven ownership RPCs absent at its inspection time.
It is not a fresh catalog read and says nothing about current Production.

The three acquire/renew/recover SQL bodies in `RPC-BODIES-NOT-APPLIED.sql` are
abort-guarded proposals. The four downstream write operations have only
disconnected local state-transition contracts. Their SQL bodies remain
**BLOCKED**; adding stub bodies would create false success. No physical
exactly-once computation or Guard execution is claimed.

## B. Relevant verified-versus-proposed inventory

`OBJECT-INVENTORY.json` is the detailed inventory, including local definition
paths, keys, readers/writers, prior catalog evidence and rollback notes.
Interpret `EXISTING` as observed in the saved Development catalog only for the
objects named in its qualification receipt; migration text alone is source
intent, not deployed state. Relevant boundaries:

| Role | Source-grounded object | Missing for this design |
| --- | --- | --- |
| Tenant and Site | `digital_observer_organizations`, `observer_sites`; product-runtime and multisite migrations, `access.ts` | Authoritative historical customer mapping, non-null eligible-Site relationship and cardinality proof. |
| Source/Event | `digital_observer_camera_sources`, `observer_intelligence_signals`; product-runtime/intelligence migrations, cloud-event route | Persisted, composite Source→Site→Tenant and Event→Source/Site constraints; historical metadata cannot be promoted to authority. |
| Incident/Risk | `observer_correlated_events`, `observer_correlated_event_links`, `digital_observer_risk_evaluations`; correlation/risk migrations and services | Composite Site matching and Incident-wide projection generations; independent FKs and risk uniqueness are not ownership fencing. |
| Effects | watch evaluations, verifications, decision intents, notification deliveries and immutable audit; migrations and service paths in the inventory | One frozen plan, semantic equality, atomic writer/receipt association and mandatory audit proof. |
| Proposed processing | `observer_event_risk_claims`, `observer_event_risk_effect_plans`, `observer_event_risk_effect_receipts`; `DRAFT-NOT-APPLIED.sql` | Not deployed; no qualified writer, authoritative reader, immutable enforcement, policy retention or PostgreSQL concurrency proof. |

## C. Proposed processing plan and immutable Snapshot

Identity is `(signal_id, risk_engine_version)` and must never be a
caller-provided Tenant key. The future writer derives exact Tenant, Site,
Source, Event, Incident and Risk from canonical rows **and** a reviewed
event-time ownership attestation. The guarded draft now proposes source ID,
ownership evidence reference and required evidence references in addition to
the prior recipient snapshot, policy/settings versions, fingerprints, expected
effect set and claim/epoch linkage. These additions are data-shape proposals,
not proof that a trusted producer or correct serializer exists.

Business need: deterministic replay and recovery of an accepted Event.
Owner: Digital Observer processing. Sensitivity: Tenant/Site, recipient and
evidence references are scoped operational and potentially personal data;
never store raw media or secrets here. Expected volume is at most one plan per
retained Event/engine version plus bounded effect receipts; actual Event rate,
version churn, bytes and index cost require measurement. Primary query is
exact key lookup, with bounded expired-lease recovery; no full-table polling.

First write must occur under the live nonce/epoch/lease fence in the same
transaction as its reviewed Risk/plan checkpoint, with a complete canonical
payload and mandatory audit linkage. On an identical retry, reread and
compare **all** semantic fields; return the original plan and do not mutate
it. The same key with different content is a visible, audited conflict and
must not overwrite recipients, settings, evidence or decision meaning. A
stale owner is denied even if its lease appeared valid before a takeover.
A different engine version is a different key and must not erase the first.
Canonical Node↔PostgreSQL serialization and digest equivalence are unproved;
a 64-hex check validates syntax only. The present schema has no immutable
first-write mechanism, composite scope FK, bounded-reference validator or
trusted reader, so the plan is **not ready to persist**.

Retention is **UNRESOLVED**. No numeric duration, TTL, cleanup job, automatic
deletion or indefinite-retention policy is approved. Separate decisions are
needed for operational plan/claim/receipts; recipient/delivery reconstruction;
evidence/audit references; source recording; identity data; investigation
access; and legal holds. The operational window must cover retry and recovery,
but its actual duration and legal exceptions require product/privacy/legal
approval before any retention implementation.

## D–G. RPC, fencing, audit and security review

The exact seven signatures, status of three guarded bodies and four blocked
bodies are in `SEVEN-RPC-IMPLEMENTATION.md` and `PERMISSIONS-AND-RPCS.md`.
Keep every existing signature unless an independently reviewed compatibility
change is required. Atomic acquisition serializes contenders on the exact
key; one live owner holds nonce plus monotonic epoch and a deadline. BUSY must
not compute. Expired takeover increments the epoch while retaining Risk,
plan, receipts and audit. Every future write locks and checks the exact claim
with `nonce = supplied`, `epoch = supplied`, `lease_expires_at > now()` and
canonical Tenant/Site/Incident scope in the **same transaction** as its row
mutation; an earlier application check is not fencing. An Incident projection
also CASes exact Incident/Site, expected generation and previous Risk or
verification reference, incrementing the generation atomically. These
generation columns are proposed, not deployed.

The intended state path is CLAIMED → RISK_PERSISTED → EFFECTS_PENDING →
COMPLETED. Risk insertion and its marker commit together. Start-effects
freezes recipients/settings and required effect identities. A record-effect
receipt is valid only when the corresponding row was durably committed with
matching scope, semantic fingerprint and fence. Completion checks Risk,
watch-rule decision, Incident risk projection, verification, decision intent,
Incident verification projection, in-app journal as applicable, mandatory
decision audit and conditional media-fault audit; Guard **eligibility** is
distinct from dispatch. Missing mandatory audit leaves retry eligibility and
blocks completion. An Outbox row is not provider delivery. A dispatch attempt
or Risk COMPLETED is not physical acknowledgment. Guard stays OFF.

Accepted Event remains canonical through every crash window. Before Risk
commit, a new epoch may recompute; after committed Risk, it must compare and
reuse the valid result and resume missing effects; after completed durable
work/before response, return the same completion reference. Crash mid-effect
retries only missing or semantically identical effects. A conflicting intent
with the same idempotency key is rejected and audited, not treated as a 23505
success. `OWNERSHIP-SNAPSHOT-COMPLETION.md` and `event-risk-fenced-writes.ts`
define the disconnected contract and synthetic tests; active Data API writers
remain unfenced and unchanged.

Security is a **proposal only**. A future reviewed caller is server-side
`service_role`, `SECURITY INVOKER`, controlled `search_path`, exact canonical
checks and no `PUBLIC`, `anon` or `authenticated` EXECUTE. Because proposed
functions are in exposed `public`, qualified grants, schema USAGE, inheritance,
Data API behavior and RLS must be tested; a private schema is preferred only
if transport compatibility is established. Do not substitute SECURITY DEFINER
for missing table rights. Prior Development catalog evidence found watch-rule
EXECUTE for `anon`, `authenticated` and `service_role`, despite one source
caller through the admin client and a service-role body guard. The guarded
ACL proposal names that **one exact signature** and its separate alternative
rollback; it has not been run. External callers and role-boundary behavior
are not proven, so applying the REVOKE is blocked. Shared default ACLs for
two creator roles affect unrelated future functions; global default-ACL
hardening is blocked. No claim of exploit follows from the broad grant alone.

## H. Historical Home and existing-data impact

| Category | Future compatible treatment | Blocking fact |
| --- | --- | --- |
| New Event with authoritative owner attestation and complete chain | Candidate for a new plan after schema/runtime gates | New-write authority and composite constraints unproved. |
| Already accepted Event/Incident/Risk | Preserve original rows, references and existing consumers; reconcile exact key before changing ACK behavior | Unfenced current effect writers and no plan cannot be assumed complete. |
| Historical Home with documented owner | Review row-level provenance and old/new reader compatibility; preserve evidence | A non-null organization reference alone is not historical authorization. |
| Ambiguous Home record | Quarantine from new claim path, leave record readable through existing lawful path | No automatic Tenant inference, backfill, reassignment or deletion. |
| Unknown or mixed Site/Source/Incident scope | Fail closed for new processing and record sanitized exception | Existing independent/nullable FKs do not prove end-to-end equality. |

The saved Development aggregate of two Home Sites and zero eligible Home
signals does not quantify historical or Production impact. No new data scan
was run. Gan Batuach Management roles and data do not become Observer Tenant
authority. Source recordings, investigation/evidence access, audit and legal
holds need their own retention decision; no historical data is changed here.

## I. Conditional forward sequence and lossless rollback

The detailed forward/rollback states are in `FORWARD-AND-ROLLBACK.md`. Gates:

1. **Identity and restore:** pin exact isolated Development target and schema;
   prove independent database/Auth and Storage restore. Stop on mismatch.
2. **Ownership and retention decisions:** adjudicate ambiguous Home mapping;
   approve immutable snapshot provenance and category-specific retention.
   Stop before constraints if either is unresolved.
3. **Security/source review:** inventory legitimate callers, role inheritance,
   Data API, RLS and exact default ACL impact. Stop on privileged broad access.
4. **Additive schema in isolated clone:** measure rows, locks and cost; create
   approved claim/plan/receipt/generation objects and new-write constraints.
   No old record is silently backfilled or removed.
5. **RPC qualification:** complete four blocked SQL bodies, atomically couple
   writer/marker/audit, install exact grants in a separately authorized
   migration, verify semantic conflicts, CAS and restart behavior.
6. **Compatibility and rollback rehearsal:** old/new readers and writers,
   in-flight claim preservation, restore and lossless forward reconciliation
   must pass before a bounded Development adapter can be separately approved.
7. **Later activation:** disabled-by-default adapter, controlled Event ACK
   reconciliation and post-activation verification. This is not authorized
   here, and no Production sequence is included.

Rollback before activation normally leaves additive objects intact; code
reversion is not equivalent to dropping persisted state. With active claims,
Risk results or incomplete effects, stop new work and retain Events,
Incidents, results, immutable plan, receipts, epochs and audit; let leases
expire and use fenced forward recovery or quarantine. With completed durable
Risk and pending Guard eligibility, keep Guard state separate and never replay
a physical action from database rollback. A mixed-version old writer that
ignores the claim is not a safe fallback. Dropping claim/history or deleting
canonical rows is prohibited. **Lossless rollback remains BLOCKED** until a
future authorized clone rehearsal proves coexistence, drain and restore.

## J. Future PostgreSQL qualification matrix — NOT RUN

Use an authorized isolated clone with representative sanitized data, original
schema receipt, independent restore point and role-boundary harness. Every
case needs transaction-level row/epoch/audit evidence, not only an HTTP 200.

| Case / failure point | Required persisted invariant and evidence |
| --- | --- |
| Two competing claims, then renewal/takeover at lease edge | One active nonce/epoch; loser BUSY; takeover epoch strictly higher; lock-wait timing and committed claim/audit rows. |
| Stale owner writes Risk, plan, effect or completion after takeover | Every mutation denied with no row/projection change; compare claim and dependent rows before/after. |
| Crash before/after Risk commit and mid-effect; process restart | Accepted Event retained; uncommitted marker absent; committed Risk reused; missing effects resumed exactly once semantically. |
| Retry same immutable plan versus conflicting payload | Exact duplicate returns original; conflicting recipients/settings/evidence/decision rejected and audited; original bytes/meaning unchanged. |
| Duplicate decision intent/Outbox, including unknown provider outcome | Equal intent no duplicate durable effect; semantic conflict rejected; unknown external outcome not reported delivered or blindly repeated. |
| Competing Incident Risk and verification projections | Generation/reference CAS prevents delayed writer replacing newer result; exact Incident/Site/Tenant checks. |
| Mandatory audit write failure | Protected transaction fails or completion remains incomplete; accepted Event remains retryable and no false receipt exists. |
| Missing/changed recipient snapshot during replay | Completion denied; original recipient set remains fixed; no expansion to newly mutable settings. |
| Cross-Tenant, cross-Site, missing Home owner | Claim and all downstream writes denied; exception/audit without inferred owner. |
| RPC/RLS/Data API matrix for anon/authenticated/service/owner | Only reviewed caller can execute; no PUBLIC inheritance leak; row and function probes use actual roles. |
| Forward migration, mixed-version readers/writers, rollback | Locks and cost measured; accepted records, plans, receipts, audit and historical evidence survive stop/revert/restore. |

These are future tests. Existing deterministic local tests model transitions,
not PostgreSQL concurrency, RLS, restart durability or rollback. No database,
camera, provider or external action was exercised for this review.

## K. Open decisions, exact blockers and separate authorization

| Missing fact / inspected source | Consequence | Next verification or decision |
| --- | --- | --- |
| Customer Tenant provenance; `HOME-MAPPING.md`, Site/organization migrations and saved aggregate | Wrong historical customer claim possible | Owner-approved row-level historical adjudication and future new-write authority review. |
| Snapshot recipient/evidence provenance and canonical serializer; `event-risk-ownership-snapshot.ts`, compatibility report, guarded draft | Immutable equality and retry cannot be trusted | Product/privacy schema decision, Node↔PostgreSQL round-trip and authorized writer/reader qualification. |
| Category-specific retention and legal holds; no approved source policy | Cannot define cleanup or prove recovery window | Owner/product/legal/privacy decision; do not invent duration. |
| Four atomic SQL writers; active risk/verification/notification/audit sources and seven-RPC matrix | Current separate writes can falsely complete or conflict | Exact row/payload mapping, reviewed transactional functions and isolated failure injection. |
| Legitimate non-source watch-rule callers and default ACL blast radius; permissions report | Exact REVOKE may break unknown caller; broad default change affects unrelated functions | Caller inventory and isolated role/Data API probes before separately approved ACL migration. |
| Lock/cost, in-flight compatibility, restore/rollback; forward report | Migration or rollback could block writes or lose accepted work | Authorized clone rehearsal, measured footprint and independent restore proof. |

None of these decisions grants current execution authority. Separate approval
is required for **any** database read, migration, ACL/RLS change, runtime
adapter, provider operation or remote publication under this task's boundary.
No retention duration or cleanup is added by this review.

## L. Validation and handoff

The local static validator `validate-review-package.mjs` reads files and
asserts containment, guards, seven signatures, exact ACL scope, draft object
inventory and disabled route imports. It has no service or database client.
Its actual result for this increment belongs in the final handoff, not in
this design specification. Local checks cannot establish PostgreSQL parsing
or behavior of the proposed SQL. Preserve the branch and all prior commits;
do not push, open a PR, merge, or claim an applied Development migration.
