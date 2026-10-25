# Observer Push-token binding — guarded database candidate

**Review-only; not applied or qualified.** `forward.sql` begins with an
unconditional exception inside a transaction. It is outside
`supabase/migrations`. No SQL, including a read-only query, was run for this
unit. A static source check is not a SQL parser, PostgreSQL concurrency test,
or RLS proof.

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
current application route permits global admins and organization permissions;
therefore an authorized actor in one of those categories could encounter a
new registration denial. Reconcile that route/DB permission delta before
activation; do not silently broaden the trigger. The trigger does not change
parent, garden-administrator, or other Management roles.

Separate delivery gap: `preparePushForNotification` currently selects active
tokens by `profile_id` without an Observer source filter. A generic Management
token for the same profile may therefore be considered for an Observer alert.
The Observer-only database index cannot solve delivery-domain separation.
Qualify and correct the delivery selector in a separate scoped unit before
claiming end-to-end notification isolation.

No table is added, so data owner/retention/volume remain the shared token
contract. The incremental index stores one entry per active Observer
installation; lookups are indexed by profile and installation. The trigger
adds bounded indexed profile/Site/membership/session reads per write. Its
cost and lock impact require a future isolated query-plan and concurrency
measurement. No paid provider/service is added by this source package.

## Exact future isolated PostgreSQL qualification (not authorized here)

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

These are future test instructions, **not** executed fixtures or proof.

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
