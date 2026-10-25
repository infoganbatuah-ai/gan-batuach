# Home registration and Event acceptance — guarded SQL review

Status: **REVIEW-ONLY, NOT APPLIED, NOT READY TO APPLY**. The companion
`HOME-REGISTRATION-RECEIPTS-NOT-APPLIED.sql` starts with a deliberate exception
inside a transaction and has no COMMIT. No route imports it. This increment
does not change the original gbi database, live ingestion, RLS or privileges.

## Source mapping and proposed transitions

| Step | Current source / exact fields | Proposed atomic boundary | Status |
| --- | --- | --- | --- |
| Canonical customer/Home/Source | `digital_observer_organizations.id,owner_profile_id,active`; `observer_sites.id,site_type,owner_profile_id,garden_id,digital_observer_organization_id,active`; `digital_observer_camera_sources.id,observer_site_id,created_by` | One fixed `(registration_id,tenant_id,site_id,source_id,owner_profile_id)` identity, positive monotonic version, mutable current pointer protected by CAS | Storage drafted; authority writer BLOCKED |
| Qualified registration | `home-registration-ownership.ts` candidate, `TrustedRegistrationFacts` and `VerifiedActorAuthority` | Lock identity and canonical Source/Site/organization in stable order; recheck fresh active server session and exact owner; append version and mandatory audit; CAS pointer in one transaction | RPC BLOCKED: deployed owner resolver, role/grant and session recheck not qualified |
| New Event acceptance | `cloud-events/route.ts` writes `observer_intelligence_signals.id,source_type='system',source_id,signal_type='ai_camera',observer_site_id,metadata` with `metadata.camera_source_id`; Site query currently omits Tenant | One *future* DB transaction must insert canonical Signal and immutable acceptance receipt together, after locking the qualified current version. The receipt freezes tenant, Home Site, Source, owner, registration ID/version, authority ref and server acceptance ref | Table drafted; atomic writer BLOCKED: current HTTP insert is a separate transaction |
| Event binding | `AcceptedEvent` and `EventBoundRegistration` in `home-registration-ownership.ts` | Draft `bind_accepted_event_v1` locks acceptance, checks exact historical version, inserts binding and mandatory audit in one transaction. A retry returns its original binding; contradiction or missing audit aborts | Conditional SQL body drafted, ungranted and unexecuted |
| Historical replay | `prospectiveHomeEventReader` requires acceptance, binding and qualified version | No receipt means no Model A ownership; no date threshold, inference or backfill | Fail-closed contract only |

The Source `created_by` and installer are not owner authority. A broad
`profiles.role='admin'`, `app_metadata`, `is_admin()` or notification recipient
is not a substitute. Platform Admin qualification and cross-owner/cross-Tenant
transfer remain denied. One Tenant may have multiple Sites.

## Privilege, audit and data boundary

The proposal uses a new unexposed schema. Its five tables have RLS enabled,
no policies, and explicit revocation for `PUBLIC`, `anon`, `authenticated` and
`service_role`. The only proposed function bodies use `SECURITY INVOKER`, an
empty search path and no EXECUTE grants. **No caller can use this draft.** A
future reviewed dedicated server role needs only the exact schema USAGE,
required table operations and function EXECUTE; database-owner privileges,
role inheritance and the Data API exposed-schema list require verification.
Private schema placement alone does not exclude privileged callers. No
`SECURITY DEFINER` or client-callable public RPC is proposed.

The minimal records are bounded IDs and server authority/acceptance references,
not raw media, device credentials, Auth tokens, recipient lists or full camera
payloads. The observation snapshot is a bounded immutable server projection;
its field list and canonical serialization are **not yet qualified**, so the
acceptance RPC is withheld. Version, acceptance, binding and audit tables have
append-only triggers; the table owner can still disable them, so a dedicated
owner/grant review and PostgreSQL tests remain necessary. A mandatory audit
insert failure must roll back its corresponding transition. The draft local
audit is not automatically equivalent to the existing
`public.immutable_audit_events` contract; exact atomic integration is open.

Data owner: Digital Observer Product/security. Sensitivity: operational
identity and authorization metadata. Expected volume: one identity per
qualified Source, one row per renewal, one acceptance and optional binding
per newly accepted Event, and bounded transition audit. Primary reads are by
Source current pointer and Event ID; primary uniqueness is explicit. There is
no TTL or deletion job. Retention/legal hold and actual storage/request cost
must be approved and measured before activation.

## Blocking facts and activation gates

1. The current Development catalog has no registration or acceptance ledger;
   `OBJECT-INVENTORY.json` records only current aggregate state (zero Home
   Sources/Signals). It cannot prove historical ownership. Preserve all old
   Signals as unqualified until individually adjudicated; never auto-backfill.
2. The canonical route currently inserts Signal with one Supabase call and
   then runs Risk. A second receipt call cannot make acceptance atomic. A
   reviewed transactional server adapter must own both writes, compare the
   *complete immutable observation* on duplicate stable IDs, and retain the
   original version on retry. `23505` alone is not semantic equivalence.
3. The source-defined owner session adapter is request-local and read-only;
   it is not a transaction-bound DB authority. Before a qualification RPC,
   prove fresh session, organization/Site/Source/owner invariants and a
   dedicated legitimate caller. Parent, installer, broad admin and mutable
   metadata may not authorize a version.
4. The proposed SQL has never been parsed or run by PostgreSQL. Before any
   apply: verify actual object ownership/ACL, role inheritance, nullable
   historical relationships, FK/index lock costs, insertion sequence, RLS and
   Data API exposure on an authorized isolated synthetic clone. Race two
   approvers and acceptance vs renewal, then test crash/retry and mandatory
   audit failure. No current source-only test proves concurrency or durability.
5. Product/privacy must set retention, legal hold and deletion criteria for
   version/acceptance/binding/audit records. No existing media retention period
   is adopted. Schema activation remains blocked until this decision.

Rollback is compatibility-first: before adapter activation, leave existing
ingestion unchanged. If any new accepted Event or version exists, disable the
adapter but retain all additive identities, versions, receipts, bindings and
audit; reconcile forward. Do not DROP or rewrite canonical Signals, risk,
intent, Outbox or historical ownership evidence. Lossless rollback has not
been proven and needs a separate isolated rehearsal.
