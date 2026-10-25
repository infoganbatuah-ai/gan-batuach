# Prospective Home registration authority — disconnected Development contract

Status: **LOCAL CONTRACT QUALIFIED; NOT DEPLOYED, NOT AUTHORIZED TO APPLY**.
The owner selected Model A (one customer Tenant, Sites beneath it) for **new**
Home Events. This document does not adjudicate historical rows and does not
turn the current nullable Site organization reference into authority.

## Source → proposed authority

| Existing source | What it proves | What it does not prove |
| --- | --- | --- |
| `20260820010000_digital_observer_product_runtime.sql` | Organization `id`, `owner_profile_id`; nullable `observer_sites.digital_observer_organization_id`; Source `observer_site_id` | One customer per Tenant, immutable ownership, event-time authority, or authorized actor at transfer |
| `20260603003000_digital_observer_multisite_foundation.sql` | Site has `owner_profile_id` | That Site owner, organization owner and Home owner are always the same person |
| `app/api/digital-observer/cameras/route.ts` | Source creation checks a Site-manage session and stores `created_by` | `created_by` is not a Home ownership attestation; `profile.role` is not a registration-authority proof |
| `app/api/digital-observer/software-connector/route.ts` | Connector creates a Site-scoped Source and records a registering actor | Registration actor need not be Home owner; source metadata is mutable |
| `app/api/video-gateway/cloud-events/route.ts` | Gateway/Source/Site checks and accepted Signal identity | Site select omits Tenant; Signal timestamp is camera-supplied; no immutable registration-version receipt |
| `lib/domain/event-engine/notifications.ts` | Recipients come from Site owner, authorized recipients and channel settings | Notification eligibility is neither ownership nor authority to register/reassign |

`lib/domain/digital-observer/home-registration-ownership.ts` is a **disconnected
port and validation layer**, not an adapter to the deployed schema. It keeps
the registering actor separate from the authorized owner/Platform Admin. The
actor resolver must be implemented with a verified server session and a
separately qualified owner/platform-authority source; accepting a client role,
email, Site membership or mutable metadata would violate the contract.

## Future atomic persistence boundary (proposed, not present)

1. A CANDIDATE has exact Home, Tenant, Site, Source, owner profile,
   registering actor, registration ID and positive version. It grants nothing.
2. Qualification reads authoritative Home/customer/Site/Source relationships,
   checks active state and contradictions, verifies a distinct actor's authority,
   then atomically CASes the Source registration version and commits an
   immutable authorization/audit receipt. Owner transfer requires a new version;
   the old version and audit remain readable. Concurrent or ambiguous transfers
   fail closed. Retention and legal-hold rules require separate approval.
3. **At new Event acceptance**, a server transaction must check the current
   qualified registration and Site/Tenant relationship and atomically freeze
   `event_id`, `site_id`, `source_id`, `registration_id`, `registration_version`,
   `authority_ref` and an unforgeable server `acceptance_ref`. Do not use device
   event time or an operational cutoff to classify legacy rows. Without this
   receipt, the prospective reader returns no authority.
4. EVENT_BOUND links that exact acceptance receipt to the immutable qualified
   version, insert-if-absent with full semantic comparison, and commits binding
   and audit together. A retry returns the original link; it never rebinds to
   the Source's current owner. This also permits a delayed first link after
   legitimate reassignment, provided the original server acceptance receipt
   already froze the version. Missing or contradictory history fails closed.
5. The local event-time reader validates acceptance, binding and registration
   history before returning Tenant/Site/Source/Event evidence. The Model A
   pre/post readers allow later Site or Source reassignment only when this
   immutable event-time evidence is present and the canonical Event/Incident/
   Risk references still match. They do not alter the active ingest route.

No actual database tables, constraints, transactions, ACLs or RLS were added.
The proposed store port **cannot establish durability** by itself. A future
reviewed, non-exposed transactional implementation must prove unique Event
binding, monotonic Source version CAS, immutable history and append-only audit
under PostgreSQL concurrency and crash/retry. The current risk claim and four
downstream writer SQL bodies remain BLOCKED; this contract does not unblock
application or adapter activation.

## Historical and notification boundary

Historical rows without a trusted server acceptance/version receipt remain
unqualified, even if their timestamp is recent or current Site membership is
non-null. Row-specific independent adjudication would be a separate approved
process; this change performs no backfill, inference or quarantine mutation.
Until a future adapter is activated, "quarantine" means **no new Model A risk
ownership claim**, not deletion or alteration of the accepted canonical Event.

Notification recipients remain governed by the existing recipient/settings
path and a future immutable decision-time snapshot. Registration owner identity
does not automatically add that person as a recipient, and replay may not
expand recipients from newer mutable settings. `notifications.ts` is unchanged.

## Exact outstanding qualification

| Missing fact | Inspected source / insufficiency | Consequence | Future gate |
| --- | --- | --- | --- |
| Authoritative Home/customer cardinality and Platform Admin scope | Product runtime and enterprise identity migrations provide candidate organization and roles but no immutable Home registration authority | Actor resolver cannot safely certify an owner or delegated platform actor | Separate authorized Development catalog/row and policy review; owner signs off exact authority criteria |
| Durable server-acceptance/version ledger | Current `cloud-events/route.ts` inserts Signal and independently triggers Risk; no registration-version receipt | No trustworthy new-vs-historical distinction or event-time binding | Reviewed additive migration and atomic acceptance integration in isolated Development, separately authorized |
| Source/Site transfer invariants and retention | Nullable and mutable links in reviewed migrations; no versioned history/retention policy | Unsafe reuse or loss of old replay authority | Review transfer process, uniqueness/CAS constraints, immutable history, retention/legal hold and rollback |
| Physical PostgreSQL guarantees | Only disconnected synthetic tests ran | No concurrency, RLS or crash-durability proof | Authorized isolated PostgreSQL transaction/race/recovery test before any migration/activation |

The local tests exercise the actual TypeScript transition/reader code with a
synthetic store. They do not prove the future store faithfully implements the
atomic port contract. No SQL was executed or database connection made.

## Isolated Development qualification preflight (source-only, 2026-10-25)

This section is the handoff for a **future separately authorized** PostgreSQL
qualification, not an execution recipe. `HOME-REGISTRATION-QUALIFICATION-CASES.json`
is a blocked-by-default test matrix, and
`check-home-registration-qualification-package.mjs` checks only its static
containment. Neither connects to a database. Existing synthetic contract tests
are not PostgreSQL evidence.

### Candidate environment and two separate permissions

The local `development/database/environment.json` names the **original**
Development project `gan-batuach-integration`, container
`supabase_db_gan-batuach-integration`, Docker context `colima-gbi`, runtime
root `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach`, and a builder database
name `gan_batuach_baseline_builder_v2`. `development/database/config.toml`
specifies loopback DB port `55422`. Historical catalog evidence in
`OBJECT-INVENTORY.json` began 2026-10-25 11:50 UTC. These are source/config
identifiers, **not a fresh health, data or isolation check**. Root
`supabase/config.toml` names `gan-batuach-push38t`/`56422`, a different profile.
The builder name alone does not establish a disposable clone, separate volume,
safe credentials or recoverability. **Clone target: UNVERIFIED / NOT PRESENT IN
THIS SOURCE INVENTORY**. No database name, URI, container or volume is invented
for it; neither gbi nor push38t is an acceptable synthetic mutation target.

Authorization A, if separately granted, is a bounded read-only catalog and
aggregate review of the positively identified original gbi Development DB:
`pg_catalog` definitions/ACLs/RLS, and counts/conflict categories over
`digital_observer_organizations`, `observer_sites`,
`digital_observer_camera_sources`, relevant enrollment/Signal rows and actor
session/role provenance. No PII, secret, media, raw row or credential output;
use explicit read-only transaction, 10-second statement and 1-second lock
timeout, bounded output, exact identity check, and stop on identity mismatch.
The earlier aggregate review is not permission to repeat it now. This read
does **not** authorize creating a clone or writing to any database.

Authorization B, separately considered **after** A and a verified restore,
would permit only an explicitly identified, isolated synthetic clone with
its own DB/container/volume identity, no Production or real Home/Auth/Storage
data, reviewed additive registration schema, synthetic fixtures, RLS/role and
Data API probes, and controlled transaction/race tests. Pin statement/lock
timeouts and resource caps after measured preflight; do not assume the
10s/1s read limits safely cover a schema apply. Stop on target ambiguity,
unexpected network route, real user rows, migration drift, backup failure,
privilege expansion or audit inconsistency. Lifecycle restart/durability
fault injection needs a **third**, explicit clone-only approval. A and B are
not interchangeable.

### Authorization A executed — bounded original Development read, 2026-10-25

The owner separately authorized **read-only SQL on gbi only**, without a clone.
At approximately 20:35 UTC, the canonical Development configuration was
rechecked. Docker context `colima-gbi` resolved to the dedicated Unix socket
under the Kingston runtime root; the existing container was running and
healthy, carried the exact `gan-batuach-integration` project label, mounted
the original named database volume, and exposed PostgreSQL only at
`127.0.0.1:55422`. A read-only transaction confirmed database `postgres`,
`transaction_read_only=on`, and PostgreSQL 17.6. The other profile on 56422
was not used. Every SQL batch used `BEGIN READ ONLY`, a 10-second local
statement timeout, a 1-second local lock timeout, and closed normally. Only
catalog metadata and bounded aggregate counts were selected; no Auth user,
session, JSON value, row ID, function execution, DDL or DML was read/run.

**Verified catalog:** the candidate organization has a required owner profile;
the canonical Site has independently nullable owner and organization FKs,
with organization deletion setting its reference to NULL. Source `created_by`
is nullable and separately references a profile. Signal and Incident Site
references are independent, not a composite Tenant/Site/Source chain. The
two pilot Home tables have only profile-owner FKs, not canonical
organization/Site acceptance FKs. The existing enterprise audit table has
RLS, but its organization FK is `ON DELETE CASCADE`; it is not an established
immutable registration/acceptance receipt. No registration, event-acceptance,
event-binding or risk-claim table/function was found by the scoped catalog
search. These are present-state catalog observations, not a migration proposal.

**Verified aggregates:** 3 organizations; 2 Home Sites; 0 Home Sites missing
an organization or Site owner; 0 mismatches between current Site owner and
organization owner; 0 organizations with multiple Home Sites or mixed
Home/non-Home Sites; 0 Home owner/site-owner rows without active membership;
0 inactive Home Sites or linked organizations. There are 0 Home camera
Sources, Gateway enrollments, Signals, Incidents, Incident links or pilot Home
test-site rows. Thus there are no current Home source/event rows on which to
qualify historical ownership, versioned acceptance, or risk-link consistency.
Zero mismatches over empty event sets is **not** historical proof. No raw
profile, Site or organization identifier was output.

**Verified authorization catalog:** one active `profiles.role='admin'`
aggregate, zero active `platform_admin` organization memberships, and zero
admin-profile owners of the current Home organizations/Sites. The existing
`current_role`, `is_admin`, `digital_observer_has_org_permission`, and
`digital_observer_current_session_active` functions are present and
`SECURITY DEFINER`; the org-permission function sets `row_security=off`.
Source-defined `is_admin()` reads the broad profile admin role, while the
enterprise route also accepts an application metadata flag. Neither proves a
dedicated Home-registration authority. No Auth users/sessions/app metadata or
real actor identities were inspected. A current owner membership is not an
immutable ownership history or authorization to register/transfer a Source.
These catalog/aggregate reads used the local `postgres` maintenance role;
they are not authenticated-user RLS or Data API behavior tests.

**Outcome:** Authorization A is complete for this bounded catalog/aggregate
scope. The candidate mapping is supported for the two *current* Home Site
rows only, not qualified as the canonical historical customer key or an
event-time authority. Registration DDL/RPC, privileged actor resolver, four
fenced Risk writers, and any clone/apply/activation remain **BLOCKED** pending
an approved customer/owner authority rule, immutable acceptance/audit design,
retention decision and separately authorized isolated PostgreSQL trial.

### Identity-source mapping and the exact gap

| Concept | Current source-defined field/function | Why not yet registration authority |
| --- | --- | --- |
| Candidate customer Tenant owner | `digital_observer_organizations.id`, `owner_profile_id`, `status`; `digital_observer_organization_memberships.organization_id/profile_id/enterprise_role/active/revoked_at` in PUSH 41 | No proved one-customer/one-Home cardinality or immutable ownership/transfer record; organization owner and Site owner may differ. |
| Site owner | `observer_sites.id/owner_profile_id/site_type/garden_id/digital_observer_organization_id` | Site owner is nullable/independently mutable; organization FK is nullable. |
| Source registration actor | `digital_observer_camera_sources.created_by`; software connector route uses authenticated `session.profile.id` | Records who wrote source metadata, not who owns Home or may transfer it. |
| Authenticated application actor | `getDigitalObserverApiUser` verifies `auth.getUser` plus `digital_observer_current_session_active`; `profiles.id/role/active` | This authenticates a principal, not Home registration authority. No client role string or email may supply it. |
| Platform Admin candidate | `public.is_admin()` resolves active `profiles.role='admin'`; enterprise route `platformAdmin()` accepts that role **or** `user.app_metadata.digital_observer_admin`; `resolveEnterpriseActor` accepts a caller boolean as a bypass | This route-level predicate crosses app scopes and has no proven narrow Home-registration authority. `digital_observer_has_org_permission` also short-circuits through `is_admin()`. No existing label/boolean may be promoted to the new resolver without independent role/session/provenance review. |
| Home identifier | `home_test_sites` and `home_camera_test_sites` are separate pilot/test tables; no verified FK to canonical organization/Site/Source acceptance | `HomeRegistrationScope.homeId` is a logical contract field, **not a deployed column**. Do not create a guessed FK or use test-home rows as the canonical customer. |
| Alert recipient | `notifications.ts` uses Site owner, authorized recipients and channel settings | Eligibility is independently governed; ownership cannot add a recipient or override a revoked preference. |

The owner has approved the prospective *direction*, not a concrete existing
Platform Admin predicate or real Home/customer cardinality. Minimum next
read-only qualification must establish whether a canonical Home/customer key
is the existing organization row, how owner and Site associations are proven,
what validates `app_metadata`/profile admin provenance, and whether current
server acceptance can be made transactional without losing accepted Events.
If those facts remain missing, the SQL and privileged resolver stay BLOCKED.

### Minimal proposed persistence delta — design only; no deployable SQL

Use the existing organization/Site/Source/Signal keys. Do **not** create a
second Tenant directory. The smallest candidate consists of: (a) an immutable
version history per Source with registration ID, positive monotonic version,
existing Tenant/Site/Source/owner and authorized actor IDs plus qualification
and audit references; (b) a current-version pointer with compare-and-swap;
(c) an Event acceptance record keyed uniquely by canonical Signal ID freezing
Source/Site/registration ID+version/authority reference at server acceptance;
(d) one immutable Event binding keyed by the same Signal ID, unique against
the acceptance receipt, with an audit reference; (e) append-only sanitized
authorization, acceptance, conflict and transfer audit. Every FK/index and
constraint must be reviewed against the real catalog and nullable historical
rows. No cascade delete of evidence, default TTL, cleanup, auto-backfill or
recipient data is proposed. Data owner: Digital Observer; content: bounded
operational IDs/authorization references, no media or secrets; retention and
legal hold **unresolved**, so schema application is blocked.

The exact `homeId` mapping, immutable audit target/atomicity, role provenance,
table ownership, schema exposure and RLS/ACL are not source-proven. For that
reason **no new DDL/RPC bodies are presented as executable or ready to apply**.
The existing `DRAFT-NOT-APPLIED.sql` abort guard remains intact and covers
separate Risk objects only. A future reviewed registration migration must
be additive and ordered; it cannot be made safe by removing that guard.

### Transaction and isolation contract for a future adapter

1. **Qualification:** under a verified server session, lock the canonical
   Source/current-version key in a stable order; verify current organization,
   Home key, Site, Source and authorized owner or independently qualified
   Platform Admin; compare expected version; insert the next immutable
   version, pointer and mandatory audit in **one short transaction**. Two
   concurrent approvers cannot both advance the same version. No network call
   while holding locks. Denial is audited where safe without disclosing rows.
2. **Acceptance:** within the same transaction as the canonical new Signal
   acceptance, lock/read the qualified registration version and current scope,
   then insert the immutable acceptance receipt and mandatory audit. The
   transfer and acceptance transactions serialize on the current-version
   key. The winning committed version—not camera time—owns the Event. A
   duplicate Signal ID compares all frozen ownership and observation fields;
   an identical retry reuses the original, a contradiction fails closed.
   **Current route does not do this; activation is blocked.**
3. **Binding:** insert-if-absent under the same Event key; compare all
   acceptance/version/authority fields and commit binding plus mandatory audit
   atomically. Retry after commit-before-response returns the original
   binding; retry after rollback sees no partial receipt. Historical Signals
   without trusted acceptance remain unqualified. Missing audit prevents a
   success receipt. Do not make Gateway ACK, Risk, notification or Guard changes
   as part of this qualification.

Lock order, uniqueness, DB permissions, isolation level, deadlock retry and
actual durability require isolated PostgreSQL proof. A source-only description
cannot prove them. A rollback preserves the original Event, all registration
versions, acceptance/binding history and audit. Before activation, stop the
new adapter; after any claim/receipt exists, retain additive storage and
reconcile forward. No DROP, deletion, unfenced old writer, or empty synthetic
clone is a lossless-rollback proof for original data.
