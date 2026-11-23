# QA public access remediation — migration 276

Scope: isolated LOCAL_SUPABASE only. No hosted SQL or application deployment.

## Existing callers and resulting permissions

| Object | Existing client | Policy after migration |
| --- | --- | --- |
| `inspection_overrides` | Admin route uses server service client | No direct user policy; service role retains its bypass |
| `inspection_signatures` | Report and QA dashboard read as signed-in user; demo setup uses service client | Read only for active admin, manager, owner or inspector with inspection-garden authority; no direct write |
| `gps_verification_logs` | GPS API inserts and returns signed-in user's row | Own row and authorized garden (or child-specific parent), child must belong to garden; no update/delete |
| `daily_operational_tasks` | Staff and garden journal pages read | Active tasks with matching role and authorized garden; global templates require an authorized current garden; no direct write |
| `daily_task_completions` | Completion API upserts; journals read | Signed-in author can insert/update own completion for authorized garden and active matching task; manager/owner can read garden completions; no delete |
| `privacy_requests` | View over `privacy_rights_requests` | Invoker security applies underlying grants and RLS |
| `observer_packages` | View over `observer_monitoring_packages` | Invoker security applies underlying grants and RLS |

The prior `management inspection signatures scoped read` policy applied to `PUBLIC`. Migration 276 replaces it; leaving it in place would OR its predicate with the new policy. This was found by the transactional anonymous test, not inferred from the table's original migration.

## Local qualification

- Existing disposable QA database had 275 registered migrations before this test, no gardens/profiles/Auth users, and exactly five RLS-disabled tables plus two definer views named above.
- Migration 276 SQL applied in one PostgreSQL transaction to the disposable QA database. Catalog result: five tables with RLS enabled and two views with `security_invoker=true`.
- `scripts/qa/check-qa-public-rls-276.sql` inserts synthetic identities/gardens/inspections/tasks, checks authorized and foreign user reads, foreign writes, anonymous denial and service role continuity, then rolls back all fixtures.
- A fresh source-only 276-migration bootstrap and scoped restore is run by `scripts/qa/check-qa-public-rls-fresh-bootstrap.mjs`; its qualification receipt is generated under `.dev-cache/tmp`.

2026-11-23 local result: **PASS**. Receipt: `.dev-cache/tmp/observer-public-rls-a80edc4d/qualification.txt` on the external Development drive. It records 276/276 migrations, 5/5 RLS-enabled target tables, 2/2 invoker views, zero broad signature policies, no Home site or enabled automation, and an isolated scoped restore PASS. The scoped dump SHA-256 is `81e7df3e7e009cf919011ad02f7bcbb6dc58a0409901d11ae7b7521cc98d40b9`. The transactional owner/foreign/anonymous/service checks also passed. The migration file SHA-256 is `ad77a7478d80b257bb3c1c78311984fe28dd7d55414c155b4d05329222f599c4`.

These checks do not prove hosted deployment behavior. The seven original Supabase advisor findings should be rechecked after a separately approved QA deployment.

## Forward-only deployment and recovery

Before a future QA migration, take a consistent PostgreSQL backup and record its hash, verify the exact 275-migration head and current policies/grants, then apply migration 276 through the canonical migration tool. Recheck RLS flags, view options, the advisor, authenticated app routes and service routes. No Production migration is authorized by this receipt.

If a newly protected legitimate path fails, stop writes to that path and use a corrective **forward** policy migration after testing. Do not disable RLS or restore the PUBLIC signature policy. A full database restore belongs in a separately isolated recovery environment first; preserve all records and migration history. A rollback that drops policies or replaces views without a verified pre-migration snapshot is not lossless and is not approved here.
