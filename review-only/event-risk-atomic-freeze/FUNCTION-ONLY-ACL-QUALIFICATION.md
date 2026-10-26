# Function-only atomic-freeze ACL candidate — not applied

This review-only increment composes with `CANONICAL-V1-NOT-APPLIED.sql` and `ATOMIC-FREEZE-NOT-APPLIED.sql` solely in a new, disposable PostgreSQL 17.6 fixture. The new SQL begins with an aborting guard. It is not a migration and does not replace PR #259/#260, their `pg-jsonb-text-v1` contract, any real audit table, or any live role.

## Candidate boundary

- `do_freeze_writer` is `NOLOGIN NOINHERIT`, owns only `review_atomic.freeze_server_v1(jsonb)`, and receives exact `SELECT`/`INSERT` on the fixture frozen/audit relations plus `UPDATE(event_id,engine_version)` on the frozen relation required by the existing `FOR SHARE` replay read. The immutable trigger rejects actual updates. It also receives exact execute rights on the already-proposed digest/freeze functions.
- `do_freeze_executor` is a separate direct-login candidate with no relation writes, no writer membership, schema `USAGE`, and `EXECUTE` on only `review_atomic.freeze_server_v1(jsonb)`. The `SECURITY DEFINER` wrapper fixes `search_path` to `pg_catalog,pg_temp`, calls the existing fully-qualified freeze implementation, and rejects `session_user` other than the exact direct login. It does not authorize a PostgREST `authenticator` session or a `SET ROLE` impersonator.
- `PUBLIC`, `anon`, `authenticated`, and `service_role` receive no EXECUTE on the wrapper or the underlying freeze function. The draft does **not** revoke or change actual `public.immutable_audit_events` rights held by `service_role`.
- The whole eventual create/revoke/grant sequence must be one reviewed transaction to avoid a default-PUBLIC-EXECUTE window. There is no live credential, member grant, Data API exposure, or schema migration in this candidate.

## Isolated behavior

`node review-only/event-risk-atomic-freeze/run-isolated-acl-qa.mjs` passed **47** assertions in a fresh PostgreSQL 17.6 container: network `none`, no mounts or published ports, read-only image root, temporary database on tmpfs. The test first proves the SQL guard aborts, then strips it only in the disposable fixture. It checks server version, role attributes, membership, function owner/security mode, exact effective EXECUTE and table rights, direct INSERT/UPDATE/DELETE denial on both relations, disallowed RPC callers, `SET ROLE` with an unrelated `session_user`, identical replay, a two-connection race, and rollback of the frozen row on mandatory-audit failure. The original `run-isolated-postgres-qa.mjs` independently passed **31** atomic-freeze assertions after this change. The fixture uses local `trust` authentication inside an inaccessible container; it proves PostgreSQL authorization behavior, **not** real host/client authentication.

## Activation blockers

1. The fixture has no trusted source for historical Model A Tenant/Site ownership, decision-time recipient/settings authority, or signer. A caller who genuinely owns the executor login could submit self-consistent fabricated references and hashes. `canonical-v1` is a digest, **not** an authority signature. The wrapper therefore cannot be labeled live-approved.
2. The proposed frozen/audit relations are synthetic, not the deployed PR #259/#260 objects. Composition with their actual schema, existing `service_role` audit privileges, RLS, role inheritance, and Data API remains unqualified.
3. A production-grade direct server login, authentication transport, credential custody, revocation, and observed `session_user` through the intended pooler are not established. The synthetic fixed login is not a credential plan.
4. Existing Development and Production databases were not queried or changed, so this is not live PostgreSQL/Supabase ACL proof and not permission to apply SQL or enable the adapter/Guard.
