# PUSH 44 — atomic notification-preference save qualification

This package addresses one verified partial-write path: the old PATCH route
upserted `public.communication_preferences` and then
`public.push_category_preferences` through separate HTTP database requests.
The second request could fail after the first committed. The proposed
`20261116224059_push44_atomic_notification_preferences.sql` migration places
both writes in one `SECURITY INVOKER` PostgreSQL function. This migration-only
review unit does **not** change the active route. A dependent route-switch unit
will make one RPC call and will not fall back to the old two-write path if that
RPC fails. Do not merge or activate the route-switch unit before the migration
is applied and verified in isolated Development.

## Authorization and data contract

- `auth.uid()` selects the only writable profile; the request cannot supply a
  profile ID. The function requires an active profile and retains the existing
  row-level security policies. It does not use `service_role` or a definer.
- The function accepts only the route's explicit mutable preference keys and
  the seven supported Push-category keys. Channel values, language, timezone,
  booleans and quiet-hour times are validated again inside PostgreSQL, so a
  direct RPC caller cannot bypass the route's Zod validation.
- `anon` and `PUBLIC` EXECUTE are revoked for this exact function signature;
  `authenticated` alone receives EXECUTE. The underlying table policies still
  constrain both inserts and updates to `profile_id = auth.uid()`.
- Existing values survive partial PATCH requests. A missing preference row is
  created using the existing table defaults. A failed validation, row update,
  category upsert or trigger raises an error and rolls back the entire call.

## Default and behavior reconciliation

The existing route's first-write defaults match the source-defined table
defaults: SMS/WhatsApp `false`; email/Push, critical Push, emergency messages,
daily digest and AI summary `true`; language `he`; timezone `Asia/Jerusalem`;
both quiet-hour times `null`; notification channel map `{}`; and the seven
Parent category-channel defaults in
`20260612012900_parent_experience_notifications_daily_journey.sql`. The new
function relies on those table defaults only when a row is first created and
retains existing columns for omitted PATCH keys. This is a **source migration**
comparison, not a read of the actual applied Development catalog.

Two intentional fail-closed differences require reviewer acceptance: the
function rejects an inactive profile (the old route checked only that an Auth
user and profile were returned), and it rejects a persisted half-populated
quiet-hours pair if a PATCH does not repair it (the old route could leave such
historical inconsistency in place). Database `now()` replaces the old server
timestamp for `updated_at`. The stored category `role` is derived from the
active profile row rather than accepted from request data.

## Local evidence and limits

`node --test scripts/qa/check-push44-preference-atomicity-local.mjs` runs the
actual migration function in an in-memory PGlite database with synthetic
profiles and reduced versions of the two tables. It verifies successful
two-table save; forced failure of the first write; forced failure of the
second write with rollback of the first; rejection of caller-supplied profile
ID and unsupported category; and `anon` denial plus authenticated own-row RLS
in that isolated model. The dependent route-switch unit separately tests its
one-RPC call, pre-write unsupported-category denial, unauthenticated denial
and no fallback when the RPC is unavailable. Those route tests are not part
of the inert migration-only unit.

PGlite is **not** proof that the actual LOCAL_SUPABASE catalog, Auth session,
PostgREST exposure, complete migration chain, default privileges or RLS
policies match this reduced model. No SQL was applied to the original
Development database or Production. No physical device or Push provider was
used. Do not mark this migration applied or PUSH 44 complete.

## Review and activation order

1. Read-only compare the actual Development catalog, grants, RLS and applied
   migration ledger with the source migrations; confirm the function name and
   signature are unused and the new migration version does not collide.
2. Review function input validation, explicit grant, category constraint,
   under-RLS `INSERT ... ON CONFLICT` and rollback with a real isolated
   PostgreSQL/Supabase clone. Test authenticated owner A/B, anonymous, and
   injected first/second-write failures; inspect both tables before and after.
3. Apply the migration to isolated Development **before** deploying the route
   revision. Verify the function's Data API exposure and exact role grants.
   The route intentionally returns an error if the function is absent.
4. Only after exact-head CI and Development integration checks, activate the
   route. Recheck non-default saved preferences and both failure paths.

Rollback before active use: leave the added function unused and revert the
route. With active use: revert the route to the former behavior only after an
explicit risk decision, because its two-request save is not atomic. Keep the
function and all preference data in place until the application is no longer
calling it; do not drop rows to simplify rollback. A lossless rollback and
full Supabase integration PASS have **not** been rehearsed.
