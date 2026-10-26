# Observer Push-token binding — guarded database candidate

**Review-only; not applied to Development or Production.** `forward.sql`
begins with an unconditional exception inside a transaction. It is outside
`supabase/migrations`. A disposable synthetic PostgreSQL qualification was
run later, as recorded below; it is not deployed-catalog, Supabase Data API,
or real-data proof. The review-only guard remains intact.

## Source and caller inventory

| Contract | Verified local source | Consequence |
| --- | --- | --- |
| Shared token table, global token uniqueness, admin/own RLS | `20260602005000_push_notifications_foundation.sql` | An owner or global admin can currently mutate bindings directly; route checks alone do not close Data API writes. |
| `disabled_reason`, `revoked_at` | `20260606009000_push_production_readiness.sql` | Explicit revoke and provider-invalid disable have existing columns. |
| Active Auth session | `20261023161928_digital_observer_push44_session_validity.sql` | Candidate requires a current session for user writes. Actual deployed status unknown. |
| Exact Site and membership | `20260603003000_digital_observer_multisite_foundation.sql`, `20260603006000_observer_site_owner_journey.sql` | Candidate accepts exact active non-kindergarten site owner or active owner/admin/operator membership, not `is_admin()` or Gan Batuach role. |
| Route registration/revoke | `app/api/push/register/route.ts`, `app/api/push/unregister/route.ts`, `lib/domain/push-service.ts` | Insert-only, replay liveness/version, own targeted revoke; no RPC is wired. |
| Shared Management delivery | `lib/management/external-delivery.ts`, `components/fcm-push-registration.tsx` | Generic Management rows remain outside the candidate predicate/trigger restrictions. Its service role can disable provider-invalid Observer tokens only after Data API role proof. |

## Candidate behavior and compatibility

`forward.sql` proposes one Observer-only partial unique index on active
`(profile_id, device_id)` and a `BEFORE INSERT OR UPDATE OR DELETE` trigger.
The existing global `device_token` uniqueness remains. The index is the
atomic protection against two different tokens concurrently claiming the same
active installation; an application read-then-insert is not atomic. Any
conflicting active legacy pair or malformed Observer binding blocks the
candidate without changing data. There is no automatic transfer or deletion.

The trigger rejects generic→Observer and Observer→generic relabeling,
cross-profile changes, source/Site/installation/platform/token/role changes,
inactive→active transitions and Observer DELETE. A replay may modify only
`app_version`, `last_seen_at`, `updated_at`. Own explicit revoke may modify
only `is_active`, `disabled_reason`, `revoked_at`, `updated_at`, and remains
available after loss of Site authorization. An authenticated insert or replay
must pass active-session, active-profile, exact active Site and explicit
ownership/membership checks. The service role has one proposed narrow
`provider_invalid_token` disable branch; it is not a registration bypass.

The trigger does **not** use `public.can_manage_observer_site()` because that
function contains a global administrator override. It deliberately fails
closed for organization-only permission holders until the current deployed
organization permission/override semantics are independently qualified. The
application registration route now uses the source-only
`getObserverPushRegistrationSite` gate instead of general Observer manage
access. It requires the exact active non-Garden Site owner or active
owner/admin/operator membership, matching the guarded trigger's Site rule.
Global administrators and organization-only permission holders remain denied
for Observer token registration unless they also hold one of those direct
Site relationships. This does not change their other Observer permissions,
parent, garden-administrator, or Management roles. The gate and trigger have
not been jointly verified through the canonical Data API; current proof is
source-level and synthetic only. Do not silently broaden the trigger.

Delivery-domain source fix (local code only): the two known callers of
`preparePushForNotification` are Management Garden routes, not the Observer
delivery service. Both that helper and `processManagementDeliveryBatch` now
select only active `fcm_web` token metadata with no `observer_site_id`, before
any result limit, and recheck returned metadata before provider submission.
The Management batch additionally rejects missing/ambiguous notification
`source_domain`; its existing recipient-authority RPC remains the Garden
authorization gate. Observer delivery uses separate Site-scoped contracts and
does not call either shared-token selector. Synthetic same-profile, multi-Site,
legacy-metadata, wrong-Site and >20-token tests passed. This is not Data API,
real-provider or canonical-database proof; legacy unclassified tokens fail
closed and require explicit re-registration for Management Push delivery.

No table is added, so data owner/retention/volume remain the shared token
contract. The incremental index stores one entry per active Observer
installation; lookups are indexed by profile and installation. The trigger
adds bounded indexed profile/Site/membership/session reads per write. Its
cost and lock impact require a future isolated query-plan and concurrency
measurement. No paid provider/service is added by this source package.

## Remaining canonical PostgreSQL and Data API qualification

1. Verify canonical isolated Development database identity, recent recoverable
   backup, actual applied migration history, columns, current RLS/grants,
   trigger/index name availability, and row counts. Do not infer applied state
   from files. Inspect legacy conflicts without printing device tokens; resolve
   each by separate owner-reviewed action, never silently delete/transfer.
2. Extract the guarded candidate into a **new ordered migration** only after
   review. Do not remove the guard in the review package or edit prior
   migrations. Verify SQL syntax and dependency order. Confirm function owner,
   definer table access, `auth.role()` provenance under actual PostgREST
   `authenticated` and `service_role`, trigger execution/grants, Data API
   exposure, and no unexpected role inheritance.
3. Use two isolated sessions with barriers: race different tokens for one
   `(profile_id,device_id)` and confirm exactly one insert commits and the
   loser gets `23505`; race same token across profiles and confirm existing
   global uniqueness. A failed write must leave zero new active tokens.
4. Probe owner/member, global admin without Site membership, parent-only,
   foreign profile, wrong Site, wrong source, wrong key/installation, inactive
   profile, expired/revoked session, and revoked Site membership. Explicit own
   revoke after Site loss must work, while new registration/replay must fail.
5. Probe direct Data API UPDATE to change each identity field, metadata,
   provider, token, profile and role; direct DELETE; inactive→active; and
   generic→Observer relabel. All must fail. Replay only liveness/version must
   succeed. After explicit revoke, a new token for the same installation may
   register; old token must remain inactive and cannot reactivate.
6. Probe `service_role` provider-invalid disable and attempts to register,
   transfer, or reactivate Observer rows. Verify generic Management register,
   refresh, invalid-provider disable and RLS behavior are unchanged.
7. Verify route-level error mapping for index `23505` and trigger exceptions;
   test concurrent provider callback versus user revoke. Measure plans, locks,
   latency and write volume. Record schema/RLS receipts and DB restore path.

The local fixture covers selected SQL behaviors from items 2–6, as itemized
below. The canonical Development catalog, actual legacy rows, PostgREST role
provenance, provider callback ordering, and application integration remain
unqualified; this checklist is not a claim that those gates passed.

## Forward, rollback and blocking facts

Forward order: backup and deployed-catalog preflight → legacy-row review →
new migration containing guard-free, reviewed preflight/index/trigger →
isolated Postgres role/RLS/race tests → application regression → separately
approved Development activation. The existing route must not be wired to an
unapplied RPC; this candidate uses no new RPC or `EXECUTE` grant.

Before activation, rollback can remove only this new trigger/function/index
through a reviewed correction while preserving all token rows. After
activation, first disable or revert Observer registration at the application
boundary, drain in-flight requests, preserve registration/revocation rows,
then replace the trigger/index only after the backward-compatibility and
collision impact is reviewed. Never drop the shared table or delete token
history. Lossless rollback has **not** been rehearsed.

Blocking facts: actual deployed catalog and row conflicts unknown (source
migrations are insufficient); `service_role` claim/trigger behavior untested;
organization-only/global-admin grant parity deliberately excluded; delivery
source separation remains open; Postgres syntax,
concurrency, RLS, rollback and Management regression untested. Therefore this
candidate is **not ready to apply**, and PUSH 44 DB enforcement is not proven.

## 2026-10-26 isolated PostgreSQL qualification attempt

The owner authorized a **new local, isolated, synthetic-only** database test,
not a connection to an existing profile or provider. The worktree was clean at
the start. No `psql`, `postgres`, `initdb`, `pg_ctl`, PostgreSQL app, or local
Homebrew PostgreSQL installation was present. The active Docker context was
`colima-gbi`; its socket denied access and Colima reported `gbi` as `Broken`.
The other named Docker profile, `push38t`, was also `Broken`; remaining Colima
profiles were stopped. No separate accessible PostgreSQL instance or image
was established. **No database was created or connected, and no SQL was run.**
An image download, new VM, or Homebrew installation exceeds this bounded
attempt and requires a separate exact decision. Do not use `gbi` as the test
source or infer its database condition from the Docker socket failure.

Source review found that the trigger's `observer_site_id` UUID rejection
pattern omitted one four-hex group, while the preflight used the complete
five-group pattern. That would reject valid Site UUIDs. The guarded SQL source
now uses the same complete pattern in both locations, and the source-only QA
check asserts their equality. This is **not PostgreSQL syntax or behavior
proof**; the unconditional execution guard remains in place.

Two material authorization gates remain open even after that source fix:

- The application `getObserverSiteAccess(..., { manage: true })` can admit
  global-administrator or organization-based scope, while the proposed trigger
  intentionally accepts only exact Site ownership or membership. Decide and
  test that mismatch rather than silently broadening database authority.
- `unregisterPushDevice` currently regards an empty update result followed by
  an empty active-row read-back as confirmed. A SELECT policy hiding an active
  row could therefore mimic successful revocation. Isolated RLS tests must
  establish actual read-back visibility and a fail-closed contract before the
  client discards its local revocation target. A source-only assertion cannot
  prove this behavior.

That first attempt was superseded by the later synthetic-only run below.
Neither Development nor Production has received this candidate.

## 2026-10-26 disposable synthetic PostgreSQL qualification

The later owner-authorized test used the pre-existing
`public.ecr.aws/supabase/postgres:17.6.1.167` image in container
`digital-observer-pgqa-20261026`. Its verified state was `running`,
`NetworkMode=none`, zero mounts and zero published ports. The Docker daemon
was only the execution transport; no existing gbi/Development database,
volume, account, Auth record, provider or network service was connected.
Each run created a distinct database from `template0`, containing only fixed
synthetic identities and the minimal source-grounded tables/roles/functions.
The runner removed its successful disposable database and the exact databases
left by earlier harness failures were separately removed; a final catalog
query found no `pgqa_push_binding_%` database.

`scripts/qa/qualify-push-registration-pg-synthetic.mjs` asserts container
isolation before it creates a database. It reads the guarded source, verifies
the exact unconditional guard, and strips that guard **in memory for the
disposable database only**. The repository SQL was never executed as a file
and its guard was not removed. The test installed the candidate there and
queried the resulting index/trigger catalog. It exercised:

- Legacy active-installation duplicates and malformed Site IDs: preflight
  aborted and rolled back without transferring or deleting test rows.
- Owner registration and liveness replay; a second token for one active
  installation was rejected. Two concurrent PostgreSQL sessions racing for
  one installation yielded one committed winner and one unique conflict.
  A concurrent same-token race across profiles likewise yielded one winner.
- Wrong Site, invalid Observer source, global admin without Site permission,
  parent without Site,
  cross-profile insert/update, admin transfer, metadata rebinding,
  expired/revoked Auth session, and post-revocation reactivation were denied.
  The owner could still read and revoke the exact active row after losing Site
  membership, while a new registration after that loss was denied.
- Authenticated `DELETE` reported no SQL error but affected zero Observer
  rows because the existing table policy has no DELETE allowance. A
  `service_role` DELETE reached the trigger and was explicitly denied.
  The service role could perform only the candidate's narrow
  provider-invalid disable, not register an Observer token.
- Generic Gan Batuach Management insert, refresh and provider-invalid
  disable remained successful in the synthetic shared table.
- Transactional removal of the candidate trigger/function/index did not
  remove token rows; `ROLLBACK` restored all three objects and the row count.

The final run exited zero. A source-only check still passed its 13 guards.
This is **synthetic PostgreSQL concurrency and RLS behavior**, not physical
provider delivery, canonical LOCAL_SUPABASE migration qualification, actual
PostgREST/JWT provenance, or a lossless rollback rehearsal with real data.
The fixture emulates `auth.uid()`, `auth.role()` and JWT session claims using
local PostgreSQL settings; it cannot prove that an external client cannot
forge those settings through the actual Supabase Data API. Its schema omits
unrelated production objects and historical rows. No release-ready or
application-activated status follows from this result.

Remaining gates: inspect the verified canonical Development catalog and
actual legacy rows with separately authorized scope; reconcile route-level
global-admin/organization-only permission parity without weakening Site
ownership; prove exact Data API claim provenance and read-back behavior;
qualify provider-callback ordering and Observer/Management delivery selector;
prepare a new reviewed migration and a separately approved Development
application/rollback rehearsal. Until then the package is **POSTGRESQL
SYNTHETIC PASS / DEPLOYMENT BLOCKED**.
