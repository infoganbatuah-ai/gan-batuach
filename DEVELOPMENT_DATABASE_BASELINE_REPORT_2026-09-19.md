# Canonical development database — services verified, application verification pending

## Latest verified checkpoint (supersedes earlier pending observations below)

- Development-only PR #59 merged as `00402d7a3134fe3e654b5c9579f15e7a1b3df1f6`.
  Both exact-source CI workflows passed on `8506689ff1a95d08314e01db7eb60f92ff7d3547`:
  Digital Observer `35455732639`, Management `35455732605`.
- 227 historical files remain unchanged. Baseline plus original ordered trigger
  fix `20260919170000` is persistently applied ONLY to canonical DEVELOPMENT.
  `development-application-receipts.json` records its source/hash/fingerprint.
- Drift PASS: expected 228, baseline included 227, post-baseline applied 1,
  missing 0, errors 0. This is explicit baseline mapping, not historical replay.
- PostgreSQL, Auth, REST, Storage, Realtime and local captured mail are healthy;
  all published ports are loopback-only. Auth/own-profile REST passed for all
  13 synthetic identities. Normal triggers stay enabled for durable fixtures.
- Storage: tiny synthetic private object uploaded; signed read HTTP 200;
  anonymous and public-URL reads denied. No real media/customer data used.
- Schema inventory records extensions/enums/relations/functions/triggers/indexes,
  RLS/policies and storage buckets. Exact ACLs remain baseline-controlled.
- Full-stack configuration is an ignored 0600 local file containing only local
  API credentials. Cumulative app restart and HTTP role journeys are next.
- GB-M29 source `a07b3ca9` is remotely preserved. All three original messaging
  migrations, canonical role/RLS and attachment metadata tests passed inside
  one rollback-only canonical transaction. Exact-source CI passed. PR #57 was
  retargeted to development (no main merge), but its task owner then requested
  it remain open/unmerged. Preserve pending integration; no persistent messaging
  schema or HTTP attachment PASS is claimed. Resolve ownership before merge.
- PUSH 38 latest `b5d2bf82` and `db26a314` preserved remotely and ledger-recorded;
  remains NOT DONE, separate, not integrated or activated.

Detailed non-sensitive receipts are in `development/database/`. Private passwords,
local service keys and raw evidence remain outside Git. Earlier checkpoint below
is retained as dated process history, not current service status.

Owner authorization: create a NEW CLEAN DEVELOPMENT-only baseline, never rewrite
historical migrations, touch Production, merge main, or deploy Vercel.

## Verified

- Source integration: `c0cf2de7e11e6e9b368fdd1fc3a068ce544ca55d`.
- 227 historical migration files retained byte-for-byte; per-statement source
  hashes, disposition and derived hashes in `development/database/baselines/`.
- Baseline `development-c0cf2de7-20260919-v1` restored to dedicated local Supabase
  project `gan-batuach-integration`, Colima context `colima-gbi`, with disk under
  `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/`.
- Local published ports verified bound to **127.0.0.1 only**, API 55421, DB 55422,
  captured-QA-mail UI 55424. No customer data or Production credentials loaded.
- Baseline equality: 11,729 exact statements plus 150 PostgreSQL-planner-equivalent
  CHECK constraints across 50 tables. Source/default/column ACLs verified, not
  replaced with permissive development grants.
- Caught and corrected initial restore inheriting Supabase default grants;
  explicit ACL artifact preserves table/function/column privacy boundaries.
- 13 admin-created synthetic QA Auth identities; unique random credentials in a
  restricted file outside Git. No real customer accounts/passwords copied.
- New ordered migration `20260919170000_classroom_scope_trigger_record_fields.sql`
  tested with fixtures in a **rollback-only** local transaction: both trigger
  variants, rejected cross-Garden assignments, parent/child, manager, staff,
  candidate, revoked staff, inspector/admin and Observer Site authorization PASS.
  No triggers disabled. Not yet persistently applied to canonical development.
- Ten baseline-contract tests, five integration-workflow tests and seven legacy
  drift-contract tests passed. Migration naming/destructive-change gate passed.
- Trigger fix committed and remotely preserved on the development-baseline branch.

## Not yet complete

- After restoring the cumulative schema, API schema-cache initialization exceeded
  its default timeout while local checks competed for resources. Storage and
  Realtime health also failed during restart. Do not ignore health checks.
- Local Auth email provider initially disabled password login; global signup
  remains disabled, email provider enabled separately for seeded QA identities.
- Auth/REST/Storage HTTP E2E, cumulative app health, persistent fixtures and new
  migration application are pending. SQL-only tests are not full-stack proof.
- Local typecheck/lint were interrupted to reduce startup resource contention;
  they are NOT passes. Require exact-commit CI and cumulative verification.
- GB-M29 remains separately preserved (source head observed `38787f3c`) pending
  canonical environment + three messaging migrations + attachment HTTP QA.
- Historical branch/worktree/stash/private evidence reconciliation remains in the
  prior ledger; no branch/worktree/stash/evidence deleted by this task.
- PUSH 38 remains NOT DONE, separate, with its qualification history preserved.

## Preservation / side effects

Main observed remotely: `8113d0607e4282dc8778540aa58c1502367f4221`, unchanged.
No Production DB operation, main merge/push, Vercel deployment or cleanup.
The first accidentally internal empty Colima `integration` VM was stopped and
retained; actual `gbi` VM/disk is on Kingston. A failed builder database is also
retained, not deleted. Both contain no customer data and are not the canonical DB.

This report is an intermediate receipt, **not** WORKFLOW TRANSITION DONE or
READY_FOR_OWNER_RELEASE. See the bootstrap receipt and current ledgers for exact
hashes and evolving state. Production statuses are intentionally not inferred.
