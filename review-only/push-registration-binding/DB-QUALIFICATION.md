# Push-token binding: database gate (proposal only)

This is source-only qualification. No SQL has been executed or added to
`supabase/migrations`; no Development or Production schema has changed.

## Verified source contracts

- `public.push_device_tokens.device_token` is globally unique in
  `20260602005000_push_notifications_foundation.sql`.
- That migration's SELECT/INSERT/UPDATE RLS permits `public.is_admin()` or
  `profile_id = auth.uid()`. It does not prevent an authorized updater from
  changing `profile_id`, `role`, `platform`, `device_id`, or `metadata`.
- `20260606009000_push_production_readiness.sql` adds `token_hash`,
  `disabled_reason`, and `revoked_at`; these do not enforce immutable binding.
- Observer registration reads the current Observer session and checks manage
  access to the exact active Site. The client-supplied Site label is not proof
  of ownership. Shared Management registration must remain available.

## Required future atomic enforcement

1. Preflight actual Development catalog, applied migrations and existing rows.
   Detect duplicate active `(profile_id, device_id)` pairs, null/legacy device
   IDs, and tokens whose metadata lacks a canonical Observer source/Site.
   Do not delete or silently reassign any conflicting row.
2. In a new ordered migration, constrain one active token per non-null
   `(profile_id, device_id)` if existing data is compatible. A candidate is a
   partial unique index on those two columns where `is_active = true` and
   `device_id IS NOT NULL`. The migration must be blocked on unresolved data.
3. Prevent direct INSERT/UPDATE through permissive client RLS from bypassing
   binding checks. Review a narrowly authorized transactional RPC or RLS plus
   immutable-binding trigger for Observer rows. It must verify the current Auth
   session, exact source/Site manage authority, token ownership, installation,
   and active status in the same transaction. Do not make a privileged function
   broadly executable. An administrator must not silently transfer a token.
4. Transfer and provider-token rotation require explicit revocation and a new
   authorized registration. Re-registration may update only `last_seen_at`,
   `updated_at`, and `app_version`. Unique conflicts must not become upserts.
5. Prove PostgreSQL concurrent insert/update, RLS (including admin and
   cross-profile), Site revocation, rollback, and no orphan active token in an
   isolated Development database before activation. Synthetic service tests
   are not database race or RLS proof.

Until this gate passes, the application rejects known conflicts and unique
races, but direct Data API writes and concurrent different-token registration
for one installation are **not proven atomically safe**. Do not present this
source-only change as full DB enforcement or release readiness.

The scoped cancellation path is also source-only until its `profile_id`,
`device_id`/token and metadata JSON filters are exercised under real RLS.
Synthetic tests prove that a normal sequential rotation leaves one active
token; they do not prove ordering against a concurrent provider callback or
direct Data API mutation. The web/native UI disables only the server row and
does not revoke provider permission or guarantee provider delivery behavior.
