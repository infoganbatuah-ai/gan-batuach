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
